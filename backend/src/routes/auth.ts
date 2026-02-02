// oxlint-disable complexity
import { Hono } from 'hono';
import type { AppContext } from '../types';
import { users } from '../db/schema';

import { generateId, generateRandomString, generateCodeVerifier, generateCodeChallenge } from '../lib/crypto';
import { buildTwitchAuthUrl, exchangeTwitchCode, getTwitchUser } from '../lib/twitch';
import { createSession, validateSessionToken, deleteSession } from '../lib/session';
import {
  setSessionCookie,
  setOAuthStateCookies,
  getOAuthStateCookies,
  clearOAuthStateCookies,
  getSessionToken,
  clearSessionCookie,
} from '../lib/cookies';
import { isProviderActive } from '../lib/auth-providers';
import { handleOAuthLogin, handleOAuthLink } from '../lib/oauth-flows';
import { AccountLinkError } from '../lib/account-link-error';

const auth = new Hono<AppContext>();

/**
 * POST /auth/anonymous
 * Create an anonymous user account and session
 */
auth.post('/anonymous', async (context) => {
  const db = context.get('db');

  // Check if anonymous auth is enabled
  if (!(await isProviderActive(db, 'anonymous'))) {
    return context.json({ error: 'Anonymous authentication is disabled' }, 403);
  }

  // Create anonymous user
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    isAnonymous: true,
  });

  // Create session
  const { sessionToken, expiresAt } = await createSession(db, userId);

  // Set session cookie
  setSessionCookie(context, sessionToken);

  return context.json({
    userId,
    isAnonymous: true,
    expiresAt: expiresAt.toISOString(),
  });
});

/**
 * GET /auth/twitch
 * Initiate Twitch OAuth flow with PKCE
 *
 * Query params:
 * - link: if "true", will link Twitch to existing authenticated account instead of creating new
 */
auth.get('/twitch', async (context) => {
  const db = context.get('db');
  const { TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI } = context.env;

  // Check if Twitch provider is enabled
  if (!(await isProviderActive(db, 'twitch'))) {
    return context.json({ error: 'Twitch authentication is disabled' }, 403);
  }

  const linkMode = context.req.query('link') === 'true';
  const redirectParam = context.req.query('redirect');

  // Generate PKCE values
  const state = generateRandomString(32);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state and verifier in cookies
  setOAuthStateCookies(context, {
    state,
    verifier: codeVerifier,
    linkMode,
    redirect: redirectParam ?? undefined,
  });

  // Build authorization URL
  const authUrl = buildTwitchAuthUrl({
    clientId: TWITCH_CLIENT_ID,
    redirectUri: TWITCH_REDIRECT_URI,
    state,
    codeChallenge,
  });

  return context.redirect(authUrl);
});

/**
 * GET /auth/twitch/callback
 * Handle Twitch OAuth callback
 *
 * Supports two modes:
 * 1. Login/Register: Creates new user or logs in existing (default)
 * 2. Link: Links Twitch to currently authenticated user (when oauth_link_mode cookie is set)
 */
auth.get('/twitch/callback', async (context) => {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REDIRECT_URI } = context.env;
  const db = context.get('db');

  // Get query parameters
  const code = context.req.query('code');
  const stateParam = context.req.query('state');
  const error = context.req.query('error');

  // Handle OAuth errors
  if (error !== undefined && error !== null && error !== '') {
    const errorDescription = context.req.query('error_description') ?? 'Unknown error';
    return context.json({ error, description: errorDescription }, 400);
  }

  if (
    code === undefined ||
    code === null ||
    code === '' ||
    stateParam === undefined ||
    stateParam === null ||
    stateParam === ''
  ) {
    return context.json({ error: 'Missing code or state parameter' }, 400);
  }

  // Get and validate OAuth cookies
  const { state, verifier, linkMode, redirect } = getOAuthStateCookies(context);

  if (state === undefined || state === null || state !== stateParam) {
    return context.json({ error: 'Invalid state parameter' }, 400);
  }

  if (verifier === undefined || verifier === null) {
    return context.json({ error: 'Missing code verifier' }, 400);
  }

  // Clean up OAuth cookies
  clearOAuthStateCookies(context);

  // If in link mode, verify user is authenticated
  let currentUserId: string | null = null;

  if (linkMode) {
    const sessionToken = getSessionToken(context);

    if (sessionToken !== null) {
      const session = await validateSessionToken(db, sessionToken);
      currentUserId = session?.userId ?? null;
    }

    if (currentUserId === null) {
      return context.json({ error: 'Authentication required for linking' }, 401);
    }
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeTwitchCode({
      code,
      clientId: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      redirectUri: TWITCH_REDIRECT_URI,
      codeVerifier: verifier,
    });

    // Get Twitch user info
    const twitchUser = await getTwitchUser({
      accessToken: tokens.access_token,
      clientId: TWITCH_CLIENT_ID,
    });

    // Prepare OAuth account data
    const accountData = {
      providerId: 'twitch' as const,
      providerUserId: twitchUser.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    };

    let userId = '';

    if (linkMode && currentUserId !== null) {
      // Link mode: attach Twitch to existing user
      try {
        await handleOAuthLink(db, currentUserId, accountData);
        userId = currentUserId;
      } catch (error) {
        if (error instanceof AccountLinkError && error.code === 'ACCOUNT_ALREADY_LINKED') {
          return context.json({ error: 'This Twitch account is already linked to another user' }, 409);
        }
        throw error;
      }
    } else {
      // Login mode: create or login user
      userId = await handleOAuthLogin(db, accountData);

      // Create session
      const { sessionToken } = await createSession(db, userId);
      setSessionCookie(context, sessionToken);
    }

    // Redirect to frontend callback page
    const frontendUrl = context.env.FRONTEND_URL ?? 'http://localhost:1487';
    const callbackUrl = new URL('/auth/callback', frontendUrl);

    // Add redirect parameter if it was provided
    if (redirect !== undefined && redirect !== null && redirect !== '') {
      callbackUrl.searchParams.set('redirect', redirect);
    }

    return context.redirect(callbackUrl.toString());
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error('Twitch OAuth error:', error);
    return context.json({ error: 'Authentication failed' }, 500);
  }
});

/**
 * GET /auth/session
 * Validate current session and return user info
 */
auth.get('/session', async (context) => {
  const db = context.get('db');

  // Get session token from cookie or Authorization header
  const sessionToken = getSessionToken(context);

  if (sessionToken === null) {
    return context.json({ error: 'No session token provided' }, 401);
  }

  // Validate session
  const session = await validateSessionToken(db, sessionToken);

  if (!session) {
    return context.json({ error: 'Invalid or expired session' }, 401);
  }

  if (!session.user) {
    return context.json({ error: 'User not found' }, 401);
  }

  // Get Twitch account if linked
  const twitchAccount = session.user?.oauthAccounts?.[0];
  let twitchUser = null;

  if (twitchAccount !== undefined && twitchAccount !== null) {
    try {
      const twitchUserData = await getTwitchUser({
        accessToken: twitchAccount.accessToken,
        clientId: context.env.TWITCH_CLIENT_ID,
      });

      twitchUser = {
        id: twitchUserData.id,
        login: twitchUserData.login,
        displayName: twitchUserData.display_name,
        profileImageUrl: twitchUserData.profile_image_url,
      };
    } catch (error) {
      // oxlint-disable-next-line no-console
      console.error('Failed to fetch Twitch user:', error);
      // Continue without Twitch user data
    }
  }

  return context.json({
    id: session.userId,
    role: session.user.role,
    twitchUser,
  });
});

/**
 * POST /auth/logout
 * Invalidate current session
 */
auth.post('/logout', async (context) => {
  const db = context.get('db');

  const sessionToken = getSessionToken(context);

  if (sessionToken !== null) {
    await deleteSession(db, sessionToken);
  }

  // Clear session cookie
  clearSessionCookie(context);

  return context.json({ success: true });
});

export { auth };
