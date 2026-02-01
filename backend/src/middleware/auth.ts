import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types';
import { hashString } from '../lib/crypto';

// Cookie name for session
const SESSION_COOKIE = 'session_token';

/**
 * Middleware to require authentication.
 * Sets c.get('userId') and c.get('userRole') if authenticated.
 * Returns 401 if not authenticated or session expired.
 */
export const requireAuth = (): MiddlewareHandler<AppContext> => {
  return async (c, next) => {
    const db = c.get('db');
    const sessionToken = getCookie(c, SESSION_COOKIE);

    if (!sessionToken) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const tokenHash = await hashString(sessionToken);

    const session = await db.query.sessions.findFirst({
      where: { tokenHash },
      with: {
        user: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return c.json({ error: 'Invalid or expired session' }, 401);
    }

    if (!session.user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Store user info in context
    c.set('userId', session.userId);
    c.set('userRole', session.user.role);

    await next();
  };
};

/**
 * Middleware to require admin role.
 * Must be used after requireAuth middleware.
 * Returns 403 if user is not an admin.
 */
export const requireAdmin = (): MiddlewareHandler<AppContext> => {
  return async (c, next) => {
    const userRole = c.get('userRole');

    if (!userRole) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (userRole !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    await next();
  };
};
