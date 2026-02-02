import type { Database } from '../db/client';
import type { AuthProviderId } from '../types';

/**
 * Check if an authentication provider is active
 * @param db - Database instance
 * @param providerId - Provider ID to check
 * @returns true if provider is active, false otherwise
 */
async function isProviderActive(db: Database, providerId: AuthProviderId): Promise<boolean> {
  const provider = await db.query.authProviders.findFirst({
    where: { id: providerId },
  });

  return provider?.isActive ?? false;
}

export { isProviderActive };
