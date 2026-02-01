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
export const requireAuth = (): MiddlewareHandler<AppContext> => async (context, next) => {
    const db = context.get('db');
    const sessionToken = getCookie(context, SESSION_COOKIE);

    if (sessionToken === undefined || sessionToken === null) {
      return context.json({ error: 'Authentication required' }, 401);
    }

    const tokenHash = await hashString(sessionToken);

    const session = await db.query.sessions.findFirst({
      where: { tokenHash },
      with: {
        user: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return context.json({ error: 'Invalid or expired session' }, 401);
    }

    if (!session.user) {
      return context.json({ error: 'User not found' }, 401);
    }

    // Store user info in context
    context.set('userId', session.userId);
    context.set('userRole', session.user.role);

    await next();
  };

/**
 * Middleware to require admin role.
 * Must be used after requireAuth middleware.
 * Returns 403 if user is not an admin.
 */
export const requireAdmin = (): MiddlewareHandler<AppContext> => async (context, next) => {
    const userRole = context.get('userRole');

    if (!userRole) {
      return context.json({ error: 'Authentication required' }, 401);
    }

    if (userRole !== 'admin') {
      return context.json({ error: 'Admin access required' }, 403);
    }

    await next();
  };
