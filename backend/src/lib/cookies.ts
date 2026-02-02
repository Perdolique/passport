import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { AppContext } from '../types';
import { SESSION_DURATION_DAYS } from './session';

// Cookie names
const SESSION_COOKIE = 'session_token';
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_VERIFIER_COOKIE = 'oauth_verifier';
const OAUTH_LINK_MODE_COOKIE = 'oauth_link_mode';
const OAUTH_REDIRECT_COOKIE = 'oauth_redirect';

// OAuth cookies expire in 10 minutes
const OAUTH_COOKIE_MAX_AGE = 600;

interface OAuthCookies {
  state: string | undefined;
  verifier: string | undefined;
  linkMode: boolean;
  redirect: string | undefined;
}

/**
 * Set session cookie with standard options
 * @param context - Hono context
 * @param sessionToken - Session token to store
 */
function setSessionCookie(context: Context<AppContext>, sessionToken: string): void {
  setCookie(context, SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

/**
 * Set OAuth state cookies (state, verifier, optional link mode and redirect)
 * @param context - Hono context
 * @param options - Object containing state, verifier, and optional link mode and redirect URL
 */
function setOAuthStateCookies(
  context: Context<AppContext>,
  options: {
    state: string;
    verifier: string;
    linkMode?: boolean;
    redirect?: string;
  },
): void {
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };

  setCookie(context, OAUTH_STATE_COOKIE, options.state, cookieOpts);
  setCookie(context, OAUTH_VERIFIER_COOKIE, options.verifier, cookieOpts);

  if (options?.linkMode === true) {
    setCookie(context, OAUTH_LINK_MODE_COOKIE, 'true', cookieOpts);
  }

  if (options?.redirect !== undefined && options.redirect !== null && options.redirect !== '') {
    setCookie(context, OAUTH_REDIRECT_COOKIE, options.redirect, cookieOpts);
  }
}

/**
 * Get OAuth state cookies
 * @param context - Hono context
 * @returns Object with OAuth state values
 */
function getOAuthStateCookies(context: Context<AppContext>): OAuthCookies {
  return {
    state: getCookie(context, OAUTH_STATE_COOKIE),
    verifier: getCookie(context, OAUTH_VERIFIER_COOKIE),
    linkMode: getCookie(context, OAUTH_LINK_MODE_COOKIE) === 'true',
    redirect: getCookie(context, OAUTH_REDIRECT_COOKIE),
  };
}

/**
 * Clear all OAuth state cookies
 * @param context - Hono context
 */
function clearOAuthStateCookies(context: Context<AppContext>): void {
  deleteCookie(context, OAUTH_STATE_COOKIE);
  deleteCookie(context, OAUTH_VERIFIER_COOKIE);
  deleteCookie(context, OAUTH_LINK_MODE_COOKIE);
  deleteCookie(context, OAUTH_REDIRECT_COOKIE);
}

/**
 * Get session token from cookie or Authorization header
 * @param context - Hono context
 * @returns Session token or null if not found
 */
function getSessionToken(context: Context<AppContext>): string | null {
  let sessionToken = getCookie(context, SESSION_COOKIE);

  if (sessionToken === undefined || sessionToken === null) {
    const authHeader = context.req.header('Authorization');
    const isBearer = authHeader?.startsWith('Bearer ');
    if (isBearer === true && authHeader !== undefined) {
      sessionToken = authHeader.slice(7);
    }
  }

  return sessionToken ?? null;
}

/**
 * Clear session cookie
 * @param context - Hono context
 */
function clearSessionCookie(context: Context<AppContext>): void {
  deleteCookie(context, SESSION_COOKIE);
}

export {
  SESSION_COOKIE,
  setSessionCookie,
  setOAuthStateCookies,
  getOAuthStateCookies,
  clearOAuthStateCookies,
  getSessionToken,
  clearSessionCookie,
};
export type { OAuthCookies };
