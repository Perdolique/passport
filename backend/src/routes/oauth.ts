import { Hono, type Context } from 'hono';
import { eq } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../types';
import { oauthClients, authorizationCodes, accessTokens, refreshTokens } from '../db/schema';
import {
  generateId,
  generateRandomString,
  hashString,
  verifyCodeChallenge,
} from '../lib/crypto';
import type { Database } from '../db/client';

const oauth = new Hono<AppContext>();

// Cookie name for session
const SESSION_COOKIE = 'session_token';

// Authorization code expiration (10 minutes)
const AUTH_CODE_EXPIRATION_MINUTES = 10;

// Access token expiration (1 hour)
const ACCESS_TOKEN_EXPIRATION_HOURS = 1;

// Refresh token expiration (30 days)
const REFRESH_TOKEN_EXPIRATION_DAYS = 30;

/**
 * Helper to get current user from session
 */
async function getCurrentUser(c: Context<AppContext>) {
  const db = c.get('db');
  const sessionToken = getCookie(c, SESSION_COOKIE);

  if (!sessionToken) {
    return null;
  }

  const tokenHash = await hashString(sessionToken);

  const session = await db.query.sessions.findFirst({
    where: { tokenHash },
    with: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

/**
 * Helper to validate client and redirect URI
 */
async function validateClient(
  db: Database,
  clientId: string,
  redirectUri: string
): Promise<{ valid: boolean; client?: typeof oauthClients.$inferSelect; error?: string }> {
  const client = await db.query.oauthClients.findFirst({
    where: { id: clientId },
  });

  if (!client) {
    return { valid: false, error: 'invalid_client' };
  }

  // Parse redirect URIs and validate
  let allowedUris: string[];
  try {
    allowedUris = JSON.parse(client.redirectUris);
  } catch {
    return { valid: false, error: 'server_error' };
  }

  if (!allowedUris.includes(redirectUri)) {
    return { valid: false, error: 'invalid_redirect_uri' };
  }

  return { valid: true, client };
}

/**
 * GET /oauth/authorize
 * OAuth2 Authorization endpoint
 *
 * Query params:
 * - response_type: must be "code"
 * - client_id: registered client ID
 * - redirect_uri: must match registered URI
 * - state: CSRF protection (recommended)
 * - scope: requested scopes (optional)
 * - code_challenge: PKCE challenge (optional but recommended)
 * - code_challenge_method: "S256" or "plain" (required if code_challenge provided)
 */
oauth.get('/authorize', async (c) => {
  const db = c.get('db');

  // Parse query parameters
  const responseType = c.req.query('response_type');
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const state = c.req.query('state');
  const scope = c.req.query('scope');
  const codeChallenge = c.req.query('code_challenge');
  const codeChallengeMethod = c.req.query('code_challenge_method');

  // Validate required parameters
  if (responseType !== 'code') {
    return c.json({ error: 'unsupported_response_type' }, 400);
  }

  if (!clientId || !redirectUri) {
    return c.json({ error: 'invalid_request', description: 'Missing client_id or redirect_uri' }, 400);
  }

  // Validate PKCE parameters
  if (codeChallenge && codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
    return c.json({ error: 'invalid_request', description: 'Invalid code_challenge_method' }, 400);
  }

  // Validate client and redirect URI
  const validation = await validateClient(db, clientId, redirectUri);

  if (!validation.valid) {
    // For security, don't redirect on client/redirect_uri errors
    return c.json({ error: validation.error }, 400);
  }

  // Check if user is authenticated
  const user = await getCurrentUser(c);

  if (!user) {
    // User not authenticated - return login required response
    // The client should redirect user to Passport login page
    // After login, user will be redirected back to /oauth/authorize with same params
    const loginUrl = new URL('/auth/login', c.req.url);
    const currentUrl = new URL(c.req.url);
    loginUrl.searchParams.set('redirect', currentUrl.pathname + currentUrl.search);

    return c.json({
      error: 'login_required',
      login_url: loginUrl.toString(),
    }, 401);
  }

  // User is authenticated - generate authorization code
  const code = generateRandomString(32);
  const codeHash = await hashString(code);
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRATION_MINUTES * 60 * 1000);

  await db.insert(authorizationCodes).values({
    id: generateId(),
    codeHash,
    clientId,
    userId: user.id,
    redirectUri,
    scope: scope || null,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: codeChallengeMethod || null,
    expiresAt,
  });

  // Redirect back to client with authorization code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);

  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return c.redirect(redirectUrl.toString());
});

/**
 * POST /oauth/token
 * OAuth2 Token endpoint - exchange authorization code for access token
 *
 * Body params (application/x-www-form-urlencoded):
 * - grant_type: must be "authorization_code"
 * - code: authorization code from /authorize
 * - redirect_uri: must match the one used in /authorize
 * - client_id: client identifier
 * - client_secret: client secret
 * - code_verifier: PKCE verifier (required if code_challenge was used)
 *
 * For grant_type=refresh_token:
 * - grant_type: must be "refresh_token"
 * - refresh_token: the refresh token
 * - client_id: client identifier
 * - client_secret: client secret
 */
oauth.post('/token', async (c) => {
  const db = c.get('db');

  // Parse body (support both JSON and form-urlencoded)
  let body: Record<string, string>;
  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('application/json')) {
    body = await c.req.json();
  } else {
    const formData = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(formData).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  }

  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = body;

  // Validate grant type
  if (grant_type !== 'authorization_code' && grant_type !== 'refresh_token') {
    return c.json({ error: 'unsupported_grant_type' }, 400);
  }

  // Validate client credentials (required for both grant types)
  if (!client_id || !client_secret) {
    return c.json({ error: 'invalid_request', description: 'Missing client credentials' }, 400);
  }

  // Validate client credentials
  const client = await db.query.oauthClients.findFirst({
    where: { id: client_id },
  });

  if (!client) {
    return c.json({ error: 'invalid_client' }, 401);
  }

  // Verify client secret
  const secretHash = await hashString(client_secret);

  if (secretHash !== client.clientSecretHash) {
    return c.json({ error: 'invalid_client' }, 401);
  }

  // Handle refresh_token grant type
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return c.json({ error: 'invalid_request', description: 'Missing refresh_token' }, 400);
    }

    const tokenHash = await hashString(refresh_token);

    const storedToken = await db.query.refreshTokens.findFirst({
      where: { tokenHash },
    });

    if (!storedToken) {
      return c.json({ error: 'invalid_grant', description: 'Invalid refresh token' }, 400);
    }

    // Verify token belongs to this client
    if (storedToken.clientId !== client_id) {
      return c.json({ error: 'invalid_grant' }, 400);
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
      return c.json({ error: 'invalid_grant', description: 'Refresh token expired' }, 400);
    }

    // Generate new access token
    const newAccessToken = generateRandomString(32);
    const accessTokenHash = await hashString(newAccessToken);
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

    await db.insert(accessTokens).values({
      id: generateId(),
      tokenHash: accessTokenHash,
      clientId: client_id,
      userId: storedToken.userId,
      scope: storedToken.scope,
      expiresAt: accessExpiresAt,
    });

    return c.json({
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_EXPIRATION_HOURS * 60 * 60,
      scope: storedToken.scope || '',
    });
  }

  // Handle authorization_code grant type
  if (!code || !redirect_uri) {
    return c.json({ error: 'invalid_request', description: 'Missing code or redirect_uri' }, 400);
  }

  // Find and validate authorization code
  const codeHash = await hashString(code);

  const authCode = await db.query.authorizationCodes.findFirst({
    where: { codeHash },
    with: { user: true },
  });

  if (!authCode) {
    return c.json({ error: 'invalid_grant', description: 'Invalid authorization code' }, 400);
  }

  // Verify code belongs to this client and redirect_uri matches
  if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
    return c.json({ error: 'invalid_grant' }, 400);
  }

  // Check expiration
  if (authCode.expiresAt < new Date()) {
    // Delete expired code
    await db.delete(authorizationCodes).where(eq(authorizationCodes.id, authCode.id));
    return c.json({ error: 'invalid_grant', description: 'Authorization code expired' }, 400);
  }

  // Verify PKCE if code_challenge was provided during authorization
  if (authCode.codeChallenge) {
    if (!code_verifier) {
      return c.json({ error: 'invalid_grant', description: 'code_verifier required' }, 400);
    }

    const isValid = await verifyCodeChallenge(
      code_verifier,
      authCode.codeChallenge,
      authCode.codeChallengeMethod || 'plain'
    );

    if (!isValid) {
      return c.json({ error: 'invalid_grant', description: 'Invalid code_verifier' }, 400);
    }
  }

  // Delete used authorization code (single use)
  await db.delete(authorizationCodes).where(eq(authorizationCodes.id, authCode.id));

  // Generate access token
  const accessToken = generateRandomString(32);
  const accessTokenHash = await hashString(accessToken);
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

  await db.insert(accessTokens).values({
    id: generateId(),
    tokenHash: accessTokenHash,
    clientId: client_id,
    userId: authCode.userId,
    scope: authCode.scope,
    expiresAt: accessExpiresAt,
  });

  // Generate refresh token
  const refreshToken = generateRandomString(32);
  const refreshTokenHash = await hashString(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    id: generateId(),
    tokenHash: refreshTokenHash,
    clientId: client_id,
    userId: authCode.userId,
    scope: authCode.scope,
    expiresAt: refreshExpiresAt,
  });

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRATION_HOURS * 60 * 60,
    refresh_token: refreshToken,
    scope: authCode.scope || '',
  });
});

/**
 * GET /oauth/userinfo
 * OAuth2 UserInfo endpoint - returns authenticated user information
 *
 * Requires Bearer token in Authorization header
 */
oauth.get('/userinfo', async (c) => {
  const db = c.get('db');

  // Get access token from Authorization header
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  const accessToken = authHeader.slice(7);
  const tokenHash = await hashString(accessToken);

  // Find access token
  const token = await db.query.accessTokens.findFirst({
    where: { tokenHash },
    with: { user: true },
  });

  if (!token) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Check expiration
  if (token.expiresAt < new Date()) {
    await db.delete(accessTokens).where(eq(accessTokens.id, token.id));
    return c.json({ error: 'invalid_token', description: 'Token expired' }, 401);
  }

  const user = token.user;

  if (!user) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Return user info
  return c.json({
    sub: user.id,
    is_anonymous: user.isAnonymous,
    created_at: user.createdAt.toISOString(),
  });
});

/**
 * POST /oauth/revoke
 * Revoke an access token
 */
oauth.post('/revoke', async (c) => {
  const db = c.get('db');

  let body: Record<string, string>;
  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('application/json')) {
    body = await c.req.json();
  } else {
    const formData = await c.req.parseBody();
    body = Object.fromEntries(
      Object.entries(formData).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  }

  const { token } = body;

  if (!token) {
    // Per RFC 7009, return 200 even if token is missing
    return c.json({ success: true });
  }

  const tokenHash = await hashString(token);
  await db.delete(accessTokens).where(eq(accessTokens.tokenHash, tokenHash));

  return c.json({ success: true });
});

export { oauth };
