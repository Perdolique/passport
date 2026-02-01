import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Available auth provider identifiers
 * Use as discriminant for provider-specific configurations
 */
export const AUTH_PROVIDER_IDS = ['anonymous', 'twitch'] as const;
export type AuthProviderId = (typeof AUTH_PROVIDER_IDS)[number];

/**
 * Auth provider types
 */
export const AUTH_PROVIDER_TYPES = ['anonymous', 'oauth'] as const;
export type AuthProviderType = (typeof AUTH_PROVIDER_TYPES)[number];

/**
 * Auth providers table - configurable authentication methods
 * Includes both OAuth providers (twitch, google) and special methods (anonymous)
 * All provider-specific config stored in metadata JSON for flexibility
 */
export const authProviders = sqliteTable('auth_providers', {
  id: text('id').primaryKey().$type<AuthProviderId>(), // 'anonymous', 'twitch', etc.
  name: text('name').notNull(), // Display name: 'Anonymous', 'Twitch', 'Google'
  type: text('type').notNull().$type<AuthProviderType>(), // 'anonymous' | 'oauth'
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
  scopesSeparator?: string; // Default: ' ' (space)
}

/**
 * Provider-specific configuration types
 * Discriminated union based on provider id
 */
export type TwitchProviderConfig = BaseOAuthConfig & {
  provider: 'twitch';
  userInfoUrl: string;
  apiBaseUrl?: string;
};

export type AnonymousProviderConfig = {
  provider: 'anonymous';
  // No configuration needed for anonymous auth
};

// Add more providers here as needed:
// export type GoogleProviderConfig = BaseOAuthConfig & {
//   provider: 'google';
//   userInfoUrl: string;
//   discoveryUrl?: string; // OIDC discovery
// };

export type ProviderConfig = TwitchProviderConfig | AnonymousProviderConfig;

/**
 * User roles enum
 */
export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Users table - stores all user accounts (both anonymous and linked)
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  isAnonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(true),
  role: text('role').notNull().default('user').$type<UserRole>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * OAuth clients table - registered applications that can authenticate via Passport
 * These are external services (SERVICE_1, SERVICE_2, etc.) that use "Login with Passport"
 */
export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  clientSecretHash: text('client_secret_hash').notNull(),
  redirectUris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Sessions table - stores active user sessions with opaque tokens
 * Token is hashed before storage for security
 */
export const sessions = sqliteTable('sessions', {
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
export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => authProviders.id), // Reference to auth_providers
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
export const authorizationCodes = sqliteTable('authorization_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope'), // Space-separated scopes (optional for now)
  codeChallenge: text('code_challenge'), // PKCE support
  codeChallengeMethod: text('code_challenge_method'), // 'S256' or 'plain'
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Access tokens table - tokens issued to OAuth clients for API access
 */
export const accessTokens = sqliteTable('access_tokens', {
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
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Export types for use in application code
export type AuthProvider = typeof authProviders.$inferSelect;
export type NewAuthProvider = typeof authProviders.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type AuthorizationCode = typeof authorizationCodes.$inferSelect;
export type NewAuthorizationCode = typeof authorizationCodes.$inferInsert;
export type AccessToken = typeof accessTokens.$inferSelect;
export type NewAccessToken = typeof accessTokens.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
