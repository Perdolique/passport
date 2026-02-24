import type { UserRole } from './db/schema'
import type { Database, WsDatabase } from './db/client'

/** Available auth provider identifiers */
type AuthProviderId = 'anonymous' | 'twitch'

/** Auth provider types */
type AuthProviderType = 'anonymous' | 'oauth'


interface Variables {
  dbHttp: Database;
  dbWs: WsDatabase;
  userId?: string;
  userRole?: UserRole;
}

interface AppContext {
  Bindings: Env;
  Variables: Variables;
}

export type {
  AppContext,
  AuthProviderId,
  AuthProviderType,
}
