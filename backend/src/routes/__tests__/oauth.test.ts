import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { oauth } from '../oauth';
import type { AppContext } from '../../types';
import { hashString } from '../../lib/crypto';

/**
 * Mock database with query builders
 */
function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    query: {
      sessions: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      oauthClients: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      authorizationCodes: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      accessTokens: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      refreshTokens: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
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
  app.use('*', async (c, next) => {
    c.set('db', mockDb as never);
    await next();
  });

  app.route('/oauth', oauth);

  return app;
}

describe('GET /oauth/authorize', () => {
  it('should return 400 for invalid response_type', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/authorize?response_type=token&client_id=test&redirect_uri=https://example.com');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'unsupported_response_type');
  });

  it('should return 400 when client_id is missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/authorize?response_type=code&redirect_uri=https://example.com');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
    expect(json).toHaveProperty('description', 'Missing client_id or redirect_uri');
  });

  it('should return 400 when redirect_uri is missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/authorize?response_type=code&client_id=test');
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
  });

  it('should return 400 for invalid code_challenge_method', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request(
      '/oauth/authorize?response_type=code&client_id=test&redirect_uri=https://example.com&code_challenge=abc&code_challenge_method=invalid',
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
    expect(json).toHaveProperty('description', 'Invalid code_challenge_method');
  });

  it('should return 400 for invalid client', async () => {
    const mockDb = createMockDb();
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request(
      '/oauth/authorize?response_type=code&client_id=invalid-client&redirect_uri=https://example.com',
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_client');
  });

  it('should return 400 for invalid redirect_uri', async () => {
    const mockDb = createMockDb();
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      redirectUris: '["https://allowed.com"]',
    });

    const app = createTestApp(mockDb);
    const res = await app.request(
      '/oauth/authorize?response_type=code&client_id=test-client&redirect_uri=https://notallowed.com',
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_redirect_uri');
  });

  it('should return 401 when user is not authenticated', async () => {
    const mockDb = createMockDb();
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      redirectUris: '["https://example.com"]',
    });

    const app = createTestApp(mockDb);
    const res = await app.request(
      '/oauth/authorize?response_type=code&client_id=test-client&redirect_uri=https://example.com',
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'login_required');
    expect(json).toHaveProperty('login_url');
  });

  it('should redirect with code when user is authenticated', async () => {
    const mockDb = createMockDb();
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      redirectUris: '["https://example.com/callback"]',
    });
    mockDb.query.sessions.findFirst = vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'user-1', isAnonymous: false },
    });

    const app = createTestApp(mockDb);
    const res = await app.request(
      '/oauth/authorize?response_type=code&client_id=test-client&redirect_uri=https://example.com/callback&state=test-state',
      {
        headers: {
          Cookie: 'session_token=valid-token',
        },
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toContain('https://example.com/callback');
    expect(location).toContain('code=');
    expect(location).toContain('state=test-state');
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe('POST /oauth/token - authorization_code', () => {
  it('should return 400 for unsupported grant_type', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password' }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'unsupported_grant_type');
  });

  it('should return 400 when client credentials are missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code' }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
    expect(json).toHaveProperty('description', 'Missing client credentials');
  });

  it('should return 401 for invalid client', async () => {
    const mockDb = createMockDb();
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'invalid-client',
        client_secret: 'secret',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_client');
  });

  it('should return 401 for invalid client secret', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('correct-secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'wrong-secret',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_client');
  });

  it('should return 400 when code is missing', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
    expect(json).toHaveProperty('description', 'Missing code or redirect_uri');
  });

  it('should return 400 for invalid authorization code', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.authorizationCodes.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        code: 'invalid-code',
        redirect_uri: 'https://example.com',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
    expect(json).toHaveProperty('description', 'Invalid authorization code');
  });

  it('should return 400 for expired authorization code', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.authorizationCodes.findFirst = vi.fn().mockResolvedValue({
      id: 'code-1',
      clientId: 'test-client',
      redirectUri: 'https://example.com',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000), // Expired
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        code: 'expired-code',
        redirect_uri: 'https://example.com',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
    expect(json).toHaveProperty('description', 'Authorization code expired');
  });

  it('should return 400 when code_verifier is required but missing', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.authorizationCodes.findFirst = vi.fn().mockResolvedValue({
      id: 'code-1',
      clientId: 'test-client',
      redirectUri: 'https://example.com',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60000),
      codeChallenge: 'some-challenge', // PKCE was used
      codeChallengeMethod: 'S256',
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        code: 'valid-code',
        redirect_uri: 'https://example.com',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
    expect(json).toHaveProperty('description', 'code_verifier required');
  });

  it('should return tokens for valid authorization code', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.authorizationCodes.findFirst = vi.fn().mockResolvedValue({
      id: 'code-1',
      clientId: 'test-client',
      redirectUri: 'https://example.com',
      userId: 'user-1',
      scope: 'openid profile',
      expiresAt: new Date(Date.now() + 60000),
      codeChallenge: null, // No PKCE
      user: { id: 'user-1' },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        code: 'valid-code',
        redirect_uri: 'https://example.com',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('access_token');
    expect(json).toHaveProperty('refresh_token');
    expect(json).toHaveProperty('token_type', 'Bearer');
    expect(json).toHaveProperty('expires_in');
    expect(json).toHaveProperty('scope', 'openid profile');
    expect(mockDb.delete).toHaveBeenCalled(); // Code should be deleted after use
  });

  it('should accept JSON body', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.authorizationCodes.findFirst = vi.fn().mockResolvedValue({
      id: 'code-1',
      clientId: 'test-client',
      redirectUri: 'https://example.com',
      userId: 'user-1',
      scope: null,
      expiresAt: new Date(Date.now() + 60000),
      codeChallenge: null,
      user: { id: 'user-1' },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'test-client',
        client_secret: 'secret',
        code: 'valid-code',
        redirect_uri: 'https://example.com',
      }),
    });

    expect(res.status).toBe(200);
  });
});

describe('POST /oauth/token - refresh_token', () => {
  it('should return 400 when refresh_token is missing', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        client_secret: 'secret',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_request');
    expect(json).toHaveProperty('description', 'Missing refresh_token');
  });

  it('should return 400 for invalid refresh token', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.refreshTokens.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        client_secret: 'secret',
        refresh_token: 'invalid-token',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
    expect(json).toHaveProperty('description', 'Invalid refresh token');
  });

  it('should return 400 when token belongs to different client', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.refreshTokens.findFirst = vi.fn().mockResolvedValue({
      id: 'token-1',
      clientId: 'other-client', // Different client
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        client_secret: 'secret',
        refresh_token: 'valid-token',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
  });

  it('should return 400 for expired refresh token', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.refreshTokens.findFirst = vi.fn().mockResolvedValue({
      id: 'token-1',
      clientId: 'test-client',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000), // Expired
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        client_secret: 'secret',
        refresh_token: 'expired-token',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toHaveProperty('error', 'invalid_grant');
    expect(json).toHaveProperty('description', 'Refresh token expired');
  });

  it('should return new access token for valid refresh token', async () => {
    const mockDb = createMockDb();
    const clientSecretHash = await hashString('secret');
    mockDb.query.oauthClients.findFirst = vi.fn().mockResolvedValue({
      id: 'test-client',
      clientSecretHash,
    });
    mockDb.query.refreshTokens.findFirst = vi.fn().mockResolvedValue({
      id: 'token-1',
      clientId: 'test-client',
      userId: 'user-1',
      scope: 'openid',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'test-client',
        client_secret: 'secret',
        refresh_token: 'valid-token',
      }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('access_token');
    expect(json).toHaveProperty('token_type', 'Bearer');
    expect(json).toHaveProperty('expires_in');
    expect(json).toHaveProperty('scope', 'openid');
    // No refresh_token in response for refresh_token grant
    expect(json).not.toHaveProperty('refresh_token');
  });
});

describe('GET /oauth/userinfo', () => {
  it('should return 401 when Authorization header is missing', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/userinfo');
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_token');
  });

  it('should return 401 when Authorization header is not Bearer', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/userinfo', {
      headers: { Authorization: 'Basic abc123' },
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_token');
  });

  it('should return 401 for invalid access token', async () => {
    const mockDb = createMockDb();
    mockDb.query.accessTokens.findFirst = vi.fn().mockResolvedValue(null);

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/userinfo', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_token');
  });

  it('should return 401 for expired access token', async () => {
    const mockDb = createMockDb();
    mockDb.query.accessTokens.findFirst = vi.fn().mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000), // Expired
      user: { id: 'user-1' },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/userinfo', {
      headers: { Authorization: 'Bearer expired-token' },
    });
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toHaveProperty('error', 'invalid_token');
    expect(json).toHaveProperty('description', 'Token expired');
  });

  it('should return user info for valid access token', async () => {
    const mockDb = createMockDb();
    const createdAt = new Date();
    mockDb.query.accessTokens.findFirst = vi.fn().mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: 'user-1',
        isAnonymous: false,
        createdAt,
      },
    });

    const app = createTestApp(mockDb);
    const res = await app.request('/oauth/userinfo', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('sub', 'user-1');
    expect(json).toHaveProperty('is_anonymous', false);
    expect(json).toHaveProperty('created_at', createdAt.toISOString());
  });
});

describe('POST /oauth/revoke', () => {
  it('should return success even when token is missing (RFC 7009)', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('success', true);
  });

  it('should revoke access token successfully', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'valid-access-token' }).toString(),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('success', true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should accept JSON body', async () => {
    const mockDb = createMockDb();
    const app = createTestApp(mockDb);

    const res = await app.request('/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-access-token' }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveProperty('success', true);
  });
});
