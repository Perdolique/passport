import type { D1Database } from '@cloudflare/workers-types';
import type { Database } from './db/client';
import type { UserRole } from './db/schema';

interface Env {
  // D1 Database binding
  DB: D1Database;

  // Environment variables
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  TWITCH_REDIRECT_URI: string;
  SESSION_SECRET: string;
  FRONTEND_URL?: string;
}

interface AppContext {
  Bindings: Env;

  Variables: {
    db: Database;
    userId?: string;
    userRole?: UserRole;
  };
}

// Re-export provider types for convenient access
export type {
  AuthProviderId,
  AuthProviderType,
  ProviderConfig,
  TwitchProviderConfig,
  AnonymousProviderConfig,
  UserRole,
} from './db/schema';

export { AUTH_PROVIDER_IDS, AUTH_PROVIDER_TYPES, USER_ROLES } from './db/schema';

export type { AppContext };
