import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { AppContext, AuthProviderId } from '../types';
import { users, sessions, oauthAccounts } from '../db/schema';
import type { Database } from '../db/client';

import {
  generateId,
  generateRandomString,
  generateCodeVerifier,
  generateCodeChallenge,
  hashString,
  createExpirationDate,
} from '../lib/crypto';

import { buildTwitchAuthUrl, exchangeTwitchCode, getTwitchUser } from '../lib/twitch';

const auth = new Hono<AppContext>();

// Cookie names
const STATE_COOKIE = 'oauth_state';
const VERIFIER_COOKIE = 'oauth_verifier';
const SESSION_COOKIE = 'session_token';

// Session duration (30 days)
const SESSION_DURATION_DAYS = 30;

/**
 * Helper to check if a provider is active
 */
async function isProviderActive(db: Database, providerId: AuthProviderId): Promise<boolean> {
  const provider = await db.query.authProviders.findFirst({
    where: { id: providerId },
  });

  return provider?.isActive ?? false;
}

/**
 * POST /auth/anonymous
 * Create an anonymous user account and session
 */
auth.post('/anonymous', async (c) => {
  const db = c.get('db');

  // Check if anonymous auth is enabled
  if (!(await isProviderActive(db, 'anonymous'))) {
    return c.json({ error: 'Anonymous authentication is disabled' }, 403);
  }

  // Create anonymous user
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    isAnonymous: true,
  });

  // Create session
  const sessionToken = generateRandomString(32);
  const tokenHash = await hashString(sessionToken);
  const sessionId = generateId();
  const expiresAt = createExpirationDate(SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    id: sessionId,
    tokenHash,
    userId,
    expiresAt,
  });

  // Set session cookie
  setCookie(c, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

  return c.json({
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
auth.get('/twitch', async (c) => {
  const db = c.get('db');
  const { TWITCH_CLIENT_ID, TWITCH_REDIRECT_URI } = c.env;

  // Check if Twitch provider is enabled
  if (!(await isProviderActive(db, 'twitch'))) {
    return c.json({ error: 'Twitch authentication is disabled' }, 403);
  }

  const linkMode = c.req.query('link') === 'true';
  const redirectParam = c.req.query('redirect');

  // Generate PKCE values
  const state = generateRandomString(32);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state and verifier in cookies (httpOnly for security)
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  setCookie(c, VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  // Store link mode in cookie if enabled
  if (linkMode) {
    setCookie(c, 'oauth_link_mode', 'true', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
  }

  // Store redirect parameter in cookie if provided
  if (redirectParam) {
    setCookie(c, 'oauth_redirect', redirectParam, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
  }

  // Build authorization URL
  const authUrl = buildTwitchAuthUrl({
    clientId: TWITCH_CLIENT_ID,
    redirectUri: TWITCH_REDIRECT_URI,
    state,
    codeChallenge,
  });

  return c.redirect(authUrl);
});

/**
 * GET /auth/twitch/callback
 * Handle Twitch OAuth callback
 *
 * Supports two modes:
 * 1. Login/Register: Creates new user or logs in existing (default)
 * 2. Link: Links Twitch to currently authenticated user (when oauth_link_mode cookie is set)
 */
auth.get('/twitch/callback', async (c) => {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REDIRECT_URI } = c.env;
  const db = c.get('db');

  // Get query parameters
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // Handle OAuth errors
  if (error) {
    const errorDescription = c.req.query('error_description') || 'Unknown error';
    return c.json({ error, description: errorDescription }, 400);
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter' }, 400);
  }

  // Verify state
  const storedState = getCookie(c, STATE_COOKIE);
  const codeVerifier = getCookie(c, VERIFIER_COOKIE);
  const linkMode = getCookie(c, 'oauth_link_mode') === 'true';
  const redirectParam = getCookie(c, 'oauth_redirect');

  if (!storedState || storedState !== state) {
    return c.json({ error: 'Invalid state parameter' }, 400);
  }

  if (!codeVerifier) {
    return c.json({ error: 'Missing code verifier' }, 400);
  }

  // Clean up OAuth cookies
  deleteCookie(c, STATE_COOKIE);
  deleteCookie(c, VERIFIER_COOKIE);
  deleteCookie(c, 'oauth_link_mode');
  deleteCookie(c, 'oauth_redirect');

  // If in link mode, verify user is authenticated
  let currentUserId: string | null = null;

  if (linkMode) {
    const sessionToken = getCookie(c, SESSION_COOKIE);

    if (sessionToken) {
      const tokenHash = await hashString(sessionToken);

      const session = await db.query.sessions.findFirst({
        where: { tokenHash },
      });

      if (session && session.expiresAt > new Date()) {
        currentUserId = session.userId;
      }
    }

    if (!currentUserId) {
      return c.json({ error: 'Authentication required for linking' }, 401);
    }
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeTwitchCode({
      code,
      clientId: TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      redirectUri: TWITCH_REDIRECT_URI,
      codeVerifier,
    });

    // Get Twitch user info
    const twitchUser = await getTwitchUser({
      accessToken: tokens.access_token,
      clientId: TWITCH_CLIENT_ID,
    });

    // Check if OAuth account already exists
    const existingAccount = await db.query.oauthAccounts.findFirst({
      where: {
        providerId: 'twitch',
        providerUserId: twitchUser.id,
      },
    });

    let userId: string;

    if (linkMode && currentUserId) {
      // Link mode: attach Twitch to existing user
      if (existingAccount) {
        if (existingAccount.userId === currentUserId) {
          // Already linked to this user, just update tokens
          await db
            .update(oauthAccounts)
            .set({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
              updatedAt: new Date(),
            })
            .where(eq(oauthAccounts.id, existingAccount.id));
        } else {
          // Linked to different user
          return c.json({ error: 'This Twitch account is already linked to another user' }, 409);
        }
      } else {
        // Link Twitch to current user
        await db.insert(oauthAccounts).values({
          id: generateId(),
          providerId: 'twitch',
          providerUserId: twitchUser.id,
          userId: currentUserId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        });

        // Mark user as non-anonymous since they now have a linked account
        await db
          .update(users)
          .set({ isAnonymous: false })
          .where(eq(users.id, currentUserId));
      }

      userId = currentUserId;
    } else if (existingAccount) {
      // Login mode: existing Twitch account found
      userId = existingAccount.userId;

      await db
        .update(oauthAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt: new Date(),
        })
        .where(eq(oauthAccounts.id, existingAccount.id));
    } else {
      // Login mode: create new user and OAuth account
      userId = generateId();

      await db.insert(users).values({
        id: userId,
        isAnonymous: false,
      });

      await db.insert(oauthAccounts).values({
        id: generateId(),
        providerId: 'twitch',
        providerUserId: twitchUser.id,
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });
    }

    // Create session (only if not in link mode, since user already has a session)
    if (!linkMode) {
      const sessionToken = generateRandomString(32);
      const tokenHash = await hashString(sessionToken);
      const sessionId = generateId();
      const expiresAt = createExpirationDate(SESSION_DURATION_DAYS);

      await db.insert(sessions).values({
        id: sessionId,
        tokenHash,
        userId,
        expiresAt,
      });

      // Set session cookie
      setCookie(c, SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
      });
    }

    // Redirect to frontend callback page
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:1487';
    const callbackUrl = new URL('/auth/callback', frontendUrl);

    // Add redirect parameter if it was provided
    if (redirectParam) {
      callbackUrl.searchParams.set('redirect', redirectParam);
    }

    return c.redirect(callbackUrl.toString());
  } catch (err) {
    console.error('Twitch OAuth error:', err);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

/**
 * GET /auth/session
 * Validate current session and return user info
 */
auth.get('/session', async (c) => {
  const db = c.get('db');

  // Get session token from cookie or Authorization header
  let sessionToken = getCookie(c, SESSION_COOKIE);

  if (!sessionToken) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7);
    }
  }

  if (!sessionToken) {
    return c.json({ error: 'No session token provided' }, 401);
  }

  // Hash the token and look up session
  const tokenHash = await hashString(sessionToken);

  const session = await db.query.sessions.findFirst({
    where: {
      tokenHash,
    },
    with: {
      user: {
        with: {
          oauthAccounts: {
            where: {
              providerId: 'twitch',
            },
          },
        },
      },
    },
  });

  if (!session) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return c.json({ error: 'Session expired' }, 401);
  }

  if (!session.user) {
    return c.json({ error: 'User not found' }, 401);
  }

  // Get Twitch account if linked
  const twitchAccount = session.user?.oauthAccounts?.[0];
  let twitchUser = null;

  if (twitchAccount) {
    try {
      const twitchUserData = await getTwitchUser({
        accessToken: twitchAccount.accessToken,
        clientId: c.env.TWITCH_CLIENT_ID,
      });

      twitchUser = {
        id: twitchUserData.id,
        login: twitchUserData.login,
        displayName: twitchUserData.display_name,
        profileImageUrl: twitchUserData.profile_image_url,
      };
    } catch (err) {
      console.error('Failed to fetch Twitch user:', err);
      // Continue without Twitch user data
    }
  }

  return c.json({
    id: session.userId,
    role: session.user.role,
    twitchUser,
  });
});

/**
 * POST /auth/logout
 * Invalidate current session
 */
auth.post('/logout', async (c) => {
  const db = c.get('db');

  const sessionToken = getCookie(c, SESSION_COOKIE);

  if (sessionToken) {
    const tokenHash = await hashString(sessionToken);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  // Clear session cookie
  deleteCookie(c, SESSION_COOKIE);

  return c.json({ success: true });
});

export { auth };
