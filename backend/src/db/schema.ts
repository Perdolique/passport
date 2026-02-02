import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Available auth provider identifiers
 * Use as discriminant for provider-specific configurations
 */
const AUTH_PROVIDER_IDS = ['anonymous', 'twitch'] as const;
type AuthProviderId = (typeof AUTH_PROVIDER_IDS)[number];

/**
 * Auth provider types
 */
const AUTH_PROVIDER_TYPES = ['anonymous', 'oauth'] as const;
type AuthProviderType = (typeof AUTH_PROVIDER_TYPES)[number];

/**
 * Auth providers table - configurable authentication methods
 * Includes both OAuth providers (twitch, google) and special methods (anonymous)
 * All provider-specific config stored in metadata JSON for flexibility
 */
const authProviders = sqliteTable('auth_providers', {
  // 'anonymous', 'twitch', etc.
  id: text('id').primaryKey().$type<AuthProviderId>(),
  // Display name: 'Anonymous', 'Twitch', 'Google'
  name: text('name').notNull(),
  // 'anonymous' | 'oauth'
  type: text('type').notNull().$type<AuthProviderType>(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // Provider-specific configuration (JSON serialized)
  // Contains OAuth credentials, URLs, and custom settings per provider
  config: text('config', { mode: 'json' }).$type<ProviderConfig | null>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Base OAuth configuration shared by most providers
 * NOTE: clientId and clientSecret are stored in environment variables for security
 */
interface BaseOAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string;
  // Default: ' ' (space)
  scopesSeparator?: string;
}

/**
 * Provider-specific configuration types
 * Discriminated union based on provider id
 */
type TwitchProviderConfig = BaseOAuthConfig & {
  provider: 'twitch';
  userInfoUrl: string;
  apiBaseUrl?: string;
};

interface AnonymousProviderConfig {
  provider: 'anonymous';
  // No configuration needed for anonymous auth
}

// Add more providers here as needed:
// Export type GoogleProviderConfig = BaseOAuthConfig & {
//   Provider: 'google';
//   UserInfoUrl: string;
//   DiscoveryUrl?: string; // OIDC discovery
// };

type ProviderConfig = TwitchProviderConfig | AnonymousProviderConfig;

/**
 * User roles enum
 */
const USER_ROLES = ['user', 'admin'] as const;
type UserRole = (typeof USER_ROLES)[number];

/**
 * Users table - stores all user accounts (both anonymous and linked)
 */
const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  isAnonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(true),
  role: text('role').notNull().default('user').$type<UserRole>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * OAuth clients table - registered applications that can authenticate via Passport
 * These are external services (SERVICE_1, SERVICE_2, etc.) that use "Login with Passport"
 */
const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  clientSecretHash: text('client_secret_hash').notNull(),
  // JSON array of allowed redirect URIs
  redirectUris: text('redirect_uris').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Sessions table - stores active user sessions with opaque tokens
 * Token is hashed before storage for security
 */
const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * OAuth accounts table - links external OAuth providers to users
 * Supports multiple providers per user (future: add more providers)
 */
const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id').primaryKey(),
  // Reference to auth_providers
  providerId: text('provider_id').notNull().references(() => authProviders.id),
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('oauth_accounts_provider_user_idx').on(table.providerId, table.providerUserId),
]);

/**
 * Authorization codes table - temporary codes for OAuth2 authorization code flow
 * Used when external services authenticate via Passport
 */
const authorizationCodes = sqliteTable('authorization_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  // Space-separated scopes (optional for now)
  scope: text('scope'),
  // PKCE support
  codeChallenge: text('code_challenge'),
  // 'S256' or 'plain'
  codeChallengeMethod: text('code_challenge_method'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Access tokens table - tokens issued to OAuth clients for API access
 */
const accessTokens = sqliteTable('access_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Refresh tokens table - long-lived tokens for obtaining new access tokens
 */
const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Export types for use in application code
type AuthProvider = typeof authProviders.$inferSelect;
type NewAuthProvider = typeof authProviders.$inferInsert;
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
type Session = typeof sessions.$inferSelect;
type NewSession = typeof sessions.$inferInsert;
type OAuthAccount = typeof oauthAccounts.$inferSelect;
type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
type OAuthClient = typeof oauthClients.$inferSelect;
type NewOAuthClient = typeof oauthClients.$inferInsert;
type AuthorizationCode = typeof authorizationCodes.$inferSelect;
type NewAuthorizationCode = typeof authorizationCodes.$inferInsert;
type AccessToken = typeof accessTokens.$inferSelect;
type NewAccessToken = typeof accessTokens.$inferInsert;
type RefreshToken = typeof refreshTokens.$inferSelect;
type NewRefreshToken = typeof refreshTokens.$inferInsert;

export {
  AUTH_PROVIDER_IDS,
  AUTH_PROVIDER_TYPES,
  USER_ROLES,
  authProviders,
  users,
  oauthClients,
  sessions,
  oauthAccounts,
  authorizationCodes,
  accessTokens,
  refreshTokens,
};

export type {
  AuthProviderId,
  AuthProviderType,
  TwitchProviderConfig,
  AnonymousProviderConfig,
  ProviderConfig,
  UserRole,
  AuthProvider,
  NewAuthProvider,
  User,
  NewUser,
  Session,
  NewSession,
  OAuthAccount,
  NewOAuthAccount,
  OAuthClient,
  NewOAuthClient,
  AuthorizationCode,
  NewAuthorizationCode,
  AccessToken,
  NewAccessToken,
  RefreshToken,
  NewRefreshToken,
};
