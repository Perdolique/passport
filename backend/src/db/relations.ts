import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

/**
 * Drizzle ORM v2 relations definition
 * Using the new defineRelations() syntax
 */
export const relations = defineRelations(schema, (r) => ({
  authProviders: {
    oauthAccounts: r.many.oauthAccounts({
      from: r.authProviders.id,
      to: r.oauthAccounts.providerId,
    }),
  },

  users: {
    sessions: r.many.sessions({
      from: r.users.id,
      to: r.sessions.userId,
    }),

    oauthAccounts: r.many.oauthAccounts({
      from: r.users.id,
      to: r.oauthAccounts.userId,
    }),

    authorizationCodes: r.many.authorizationCodes({
      from: r.users.id,
      to: r.authorizationCodes.userId,
    }),

    accessTokens: r.many.accessTokens({
      from: r.users.id,
      to: r.accessTokens.userId,
    }),

    refreshTokens: r.many.refreshTokens({
      from: r.users.id,
      to: r.refreshTokens.userId,
    }),
  },

  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
    }),
  },

  oauthAccounts: {
    user: r.one.users({
      from: r.oauthAccounts.userId,
      to: r.users.id,
    }),

    provider: r.one.authProviders({
      from: r.oauthAccounts.providerId,
      to: r.authProviders.id,
    }),
  },

  oauthClients: {
    authorizationCodes: r.many.authorizationCodes({
      from: r.oauthClients.id,
      to: r.authorizationCodes.clientId,
    }),

    accessTokens: r.many.accessTokens({
      from: r.oauthClients.id,
      to: r.accessTokens.clientId,
    }),

    refreshTokens: r.many.refreshTokens({
      from: r.oauthClients.id,
      to: r.refreshTokens.clientId,
    }),
  },

  authorizationCodes: {
    client: r.one.oauthClients({
      from: r.authorizationCodes.clientId,
      to: r.oauthClients.id,
    }),

    user: r.one.users({
      from: r.authorizationCodes.userId,
      to: r.users.id,
    }),
  },

  accessTokens: {
    client: r.one.oauthClients({
      from: r.accessTokens.clientId,
      to: r.oauthClients.id,
    }),

    user: r.one.users({
      from: r.accessTokens.userId,
      to: r.users.id,
    }),
  },

  refreshTokens: {
    client: r.one.oauthClients({
      from: r.refreshTokens.clientId,
      to: r.oauthClients.id,
    }),

    user: r.one.users({
      from: r.refreshTokens.userId,
      to: r.users.id,
    }),
  },
}));
