import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { auth } from '../auth';
import type { AppContext } from '../../types';

/**
 * Mock database with query builders
 */
function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    query: {
      authProviders: {
        findFirst: vi.fn().mockResolvedValue({ id: 'anonymous', isActive: true }),
      },
      sessions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      oauthAccounts: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(null),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(null),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(null),
    }),
    ...overrides,
  };
}

/**
 * Create test app with mocked database
 */
function createTestApp(mockDb: ReturnType<typeof createMockDb>) {
  const app = new Hono<AppContext>();

  // Mock database middleware
  app.use('*', async (context, next) => {
    context.set('db', mockDb as never);
    await next();
  });

  // Mock environment variables
  app.use('*', async (context, next) => {
    context.env = {
      TWITCH_CLIENT_ID: 'test-client-id',
      TWITCH_CLIENT_SECRET: 'test-client-secret',
      TWITCH_REDIRECT_URI: 'https://example.com/auth/twitch/callback',
      SESSION_SECRET: 'test-session-secret',
    } as never;
    await next();
  });

  app.route('/auth', auth);

  return app;
}

describe('POST /auth/anonymous', () => {
  it('should create anonymous user and return session info', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/anonymous', { method: 'POST' });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('userId');
    expect(json).toHaveProperty('isAnonymous', true);
    expect(json).toHaveProperty('expiresAt');
    // Users + sessions
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should set session cookie', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/anonymous', { method: 'POST' });

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('session_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
  });

  it('should return 403 when anonymous auth is disabled', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue({ id: 'anonymous', isActive: false });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/anonymous', { method: 'POST' });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toHaveProperty('error', 'Anonymous authentication is disabled');
  });

  it('should return 403 when anonymous provider not found', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/anonymous', { method: 'POST' });

    expect(res.status).toBe(403);
  });
});

describe('GET /auth/twitch', () => {
  it('should redirect to Twitch authorization URL', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue({ id: 'twitch', isActive: true });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/twitch');

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('https://id.twitch.tv/oauth2/authorize');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
  });

  it('should set OAuth state and verifier cookies', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue({ id: 'twitch', isActive: true });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/twitch');

    const setCookieHeader = res.headers.get('Set-Cookie');
    expect(setCookieHeader).toContain('oauth_state=');
    expect(setCookieHeader).toContain('oauth_verifier=');
  });

  it('should set link mode cookie when link=true', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue({ id: 'twitch', isActive: true });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/twitch?link=true');

    const setCookieHeader = res.headers.get('Set-Cookie');
    expect(setCookieHeader).toContain('oauth_link_mode=');
  });

  it('should return 403 when Twitch provider is disabled', async () => {
    const mockDb = createMockDb();
    mockDb.query.authProviders.findFirst = vi.fn().mockResolvedValue({ id: 'twitch', isActive: false });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/twitch');
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toHaveProperty('error', 'Twitch authentication is disabled');
  });
});

describe('GET /auth/twitch/callback', () => {
  it('should return 400 when OAuth error is present', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/twitch/callback?error=access_denied&error_description=User%20denied%20access');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'access_denied');
    expect(json).toHaveProperty('description', 'User denied access');
  });

  it('should return 400 when code or state is missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/twitch/callback');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'Missing code or state parameter');
  });

  it('should return 400 when state is invalid', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/twitch/callback?code=test-code&state=invalid-state', {
      headers: {
        Cookie: 'oauth_state=different-state; oauth_verifier=test-verifier',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'Invalid state parameter');
  });

  it('should return 400 when code verifier is missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/twitch/callback?code=test-code&state=test-state', {
      headers: {
        Cookie: 'oauth_state=test-state',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'Missing code verifier');
  });
});

describe('GET /auth/session', () => {
  it('should return 401 when no session token provided', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/session');
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'No session token provided');
  });

  it('should return 401 when session is invalid', async () => {
    const mockDb = createMockDb();
    mockDb.query.sessions.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/session', {
      headers: {
        Cookie: 'session_token=invalid-token',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'Invalid or expired session');
  });

  it('should return 401 and delete session when expired', async () => {
    const mockDb = createMockDb();
    mockDb.query.sessions.findFirst = vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      // Expired 1 second ago
      expiresAt: new Date(Date.now() - 1000),
      user: { isAnonymous: true },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/session', {
      headers: {
        Cookie: 'session_token=expired-token',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'Invalid or expired session');
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should return user info for valid session from cookie', async () => {
    const mockDb = createMockDb();
    // 1 day from now
    const expiresAt = new Date(Date.now() + 86_400_000);
    mockDb.query.sessions.findFirst = vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt,
      user: {
        id: 'user-1',
        isAnonymous: true,
        role: 'user',
        oauthAccounts: [],
      },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/session', {
      headers: {
        Cookie: 'session_token=valid-token',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('id', 'user-1');
    expect(json).toHaveProperty('role', 'user');
    expect(json).toHaveProperty('twitchUser', null);
  });

  it('should return user info for valid session from Authorization header', async () => {
    const mockDb = createMockDb();
    const expiresAt = new Date(Date.now() + 86_400_000);
    mockDb.query.sessions.findFirst = vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt,
      user: {
        id: 'user-1',
        isAnonymous: false,
        role: 'admin',
        oauthAccounts: [],
      },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/auth/session', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('id', 'user-1');
    expect(json).toHaveProperty('role', 'admin');
  });
});

describe('POST /auth/logout', () => {
  it('should delete session and clear cookie', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: 'session_token=valid-token',
      },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('success', true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should return success even without session token', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/logout', { method: 'POST' });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('success', true);
  });

  it('should clear session cookie in response', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: 'session_token=valid-token',
      },
    });

    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('session_token=');
  });
});
