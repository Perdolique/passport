import * as v from 'valibot';

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';

/**
 * Schema for Twitch OAuth token response
 */
const TwitchTokenResponseSchema = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  expires_in: v.number(),
  token_type: v.string(),
  scope: v.array(v.string()),
});

export type TwitchTokenResponse = v.InferOutput<typeof TwitchTokenResponseSchema>;

/**
 * Schema for Twitch user data
 */
const TwitchUserSchema = v.object({
  id: v.string(),
  login: v.string(),
  display_name: v.string(),
  email: v.optional(v.string()),
  profile_image_url: v.string(),
});

export type TwitchUser = v.InferOutput<typeof TwitchUserSchema>;

/**
 * Schema for Twitch users API response
 */
const TwitchUsersResponseSchema = v.object({
  data: v.array(TwitchUserSchema),
});

/**
 * Build the Twitch OAuth authorization URL
 */
export function buildTwitchAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string[];
}): string {
  const { clientId, redirectUri, state, codeChallenge, scopes = ['user:read:email'] } = params;

  const url = new URL(TWITCH_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeTwitchCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TwitchTokenResponse> {
  const { code, clientId, clientSecret, redirectUri, codeVerifier } = params;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twitch token exchange failed: ${error}`);
  }

  const data = await response.json();

  return v.parse(TwitchTokenResponseSchema, data);
}

/**
 * Get Twitch user info using access token
 */
export async function getTwitchUser(params: {
  accessToken: string;
  clientId: string;
}): Promise<TwitchUser> {
  const { accessToken, clientId } = params;

  const response = await fetch(TWITCH_USERS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Twitch user: ${error}`);
  }

  const json = await response.json();
  const data = v.parse(TwitchUsersResponseSchema, json);

  if (data.data.length === 0) {
    throw new Error('No Twitch user found');
  }

  return data.data[0];
}

/**
 * Refresh Twitch access token
 */
export async function refreshTwitchToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TwitchTokenResponse> {
  const { refreshToken, clientId, clientSecret } = params;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twitch token refresh failed: ${error}`);
  }

  const data = await response.json();

  return v.parse(TwitchTokenResponseSchema, data);
}
