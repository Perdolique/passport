import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTwitchAuthUrl, exchangeTwitchCode, getTwitchUser, refreshTwitchToken } from '../twitch';

describe('buildTwitchAuthUrl', () => {
  const baseParams = {
    clientId: 'test-client-id',
    redirectUri: 'https://example.com/callback',
    state: 'random-state-123',
    codeChallenge: 'test-code-challenge',
  };

  it('should build a valid URL with required parameters', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://id.twitch.tv');
    expect(parsed.pathname).toBe('/oauth2/authorize');
  });

  it('should include client_id parameter', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
  });

  it('should include redirect_uri parameter', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
  });

  it('should include state parameter', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('state')).toBe('random-state-123');
  });

  it('should include code_challenge and method', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('code_challenge')).toBe('test-code-challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should set response_type to code', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('should use default scope user:read:email', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('scope')).toBe('user:read:email');
  });

  it('should allow custom scopes', () => {
    const url = buildTwitchAuthUrl({
      ...baseParams,
      scopes: ['user:read:email', 'channel:read:subscriptions'],
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get('scope')).toBe('user:read:email channel:read:subscriptions');
  });

  it('should handle empty scopes array', () => {
    const url = buildTwitchAuthUrl({
      ...baseParams,
      scopes: [],
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get('scope')).toBe('');
  });

  it('should properly encode special characters in redirect_uri', () => {
    const url = buildTwitchAuthUrl({
      ...baseParams,
      redirectUri: 'https://example.com/callback?foo=bar&baz=qux',
    });

    // URL should be valid and parseable
    expect(() => new URL(url)).not.toThrow();

    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.com/callback?foo=bar&baz=qux',
    );
  });
});

describe('exchangeTwitchCode', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseParams = {
    code: 'test-auth-code',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://example.com/callback',
    codeVerifier: 'test-code-verifier',
  };

  const validTokenResponse = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 14400,
    token_type: 'bearer',
    scope: ['user:read:email'],
  };

  it('should exchange code for tokens successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validTokenResponse),
    });

    const result = await exchangeTwitchCode(baseParams);

    expect(result).toEqual(validTokenResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://id.twitch.tv/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
  });

  it('should include all required parameters in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validTokenResponse),
    });

    await exchangeTwitchCode(baseParams);

    const [, options] = mockFetch.mock.calls[0];
    const body = new URLSearchParams(options.body);

    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('code')).toBe('test-auth-code');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe('https://example.com/callback');
    expect(body.get('code_verifier')).toBe('test-code-verifier');
  });

  it('should throw error when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Invalid authorization code'),
    });

    await expect(exchangeTwitchCode(baseParams)).rejects.toThrow(
      'Twitch token exchange failed: Invalid authorization code',
    );
  });

  it('should throw error when response schema is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'response' }),
    });

    await expect(exchangeTwitchCode(baseParams)).rejects.toThrow();
  });
});

describe('getTwitchUser', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseParams = {
    accessToken: 'test-access-token',
    clientId: 'test-client-id',
  };

  const validUserResponse = {
    data: [
      {
        id: '12345',
        login: 'testuser',
        display_name: 'TestUser',
        email: 'test@example.com',
        profile_image_url: 'https://static-cdn.jtvnw.net/user/12345.png',
      },
    ],
  };

  it('should fetch user info successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validUserResponse),
    });

    const result = await getTwitchUser(baseParams);

    expect(result).toEqual(validUserResponse.data[0]);
  });

  it('should include correct headers in request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validUserResponse),
    });

    await getTwitchUser(baseParams);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.twitch.tv/helix/users',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-access-token',
          'Client-Id': 'test-client-id',
        },
      }),
    );
  });

  it('should throw error when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(getTwitchUser(baseParams)).rejects.toThrow(
      'Failed to get Twitch user: Unauthorized',
    );
  });

  it('should throw error when no user found in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await expect(getTwitchUser(baseParams)).rejects.toThrow('No Twitch user found');
  });

  it('should handle user without email (optional field)', async () => {
    const userWithoutEmail = {
      data: [
        {
          id: '12345',
          login: 'testuser',
          display_name: 'TestUser',
          profile_image_url: 'https://static-cdn.jtvnw.net/user/12345.png',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(userWithoutEmail),
    });

    const result = await getTwitchUser(baseParams);

    expect(result.email).toBeUndefined();
    expect(result.id).toBe('12345');
  });
});

describe('refreshTwitchToken', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseParams = {
    refreshToken: 'test-refresh-token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  const validTokenResponse = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 14400,
    token_type: 'bearer',
    scope: ['user:read:email'],
  };

  it('should refresh token successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validTokenResponse),
    });

    const result = await refreshTwitchToken(baseParams);

    expect(result).toEqual(validTokenResponse);
  });

  it('should include correct parameters in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validTokenResponse),
    });

    await refreshTwitchToken(baseParams);

    const [, options] = mockFetch.mock.calls[0];
    const body = new URLSearchParams(options.body);

    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('test-refresh-token');
  });

  it('should throw error when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Invalid refresh token'),
    });

    await expect(refreshTwitchToken(baseParams)).rejects.toThrow(
      'Twitch token refresh failed: Invalid refresh token',
    );
  });

  it('should throw error when response schema is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ incomplete: 'response' }),
    });

    await expect(refreshTwitchToken(baseParams)).rejects.toThrow();
  });
});
