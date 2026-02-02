import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users, oauthAccounts } from '../db/schema';
import { AccountLinkError } from './account-link-error';
import { generateId } from './crypto';
import type { AuthProviderId } from '../types';

interface OAuthAccountData {
  providerId: AuthProviderId;
  providerUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

/**
 * Handle OAuth login/register flow
 * If account exists, updates tokens and returns existing user ID
 * If account doesn't exist, creates new user and account
 * @param db - Database instance
 * @param accountData - OAuth account data
 * @returns User ID (existing or newly created)
 */
async function handleOAuthLogin(db: Database, accountData: OAuthAccountData): Promise<string> {
  // Check if OAuth account already exists
  const existingAccount = await db.query.oauthAccounts.findFirst({
    where: {
      providerId: accountData.providerId,
      providerUserId: accountData.providerUserId,
    },
  });

  if (existingAccount !== undefined && existingAccount !== null) {
    // Update tokens
    await db
      .update(oauthAccounts)
      .set({
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        tokenExpiresAt: accountData.tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(oauthAccounts.id, existingAccount.id));

    return existingAccount.userId;
  }

  // Create new user and OAuth account
  const userId = generateId();

  await db.insert(users).values({
    id: userId,
    isAnonymous: false,
  });

  await db.insert(oauthAccounts).values({
    id: generateId(),
    ...accountData,
    userId,
  });

  return userId;
}

/**
 * Handle OAuth account linking to existing user
 * @param db - Database instance
 * @param userId - User ID to link account to
 * @param accountData - OAuth account data
 * @throws Error with code 'ACCOUNT_ALREADY_LINKED' if account is linked to different user
 */
async function handleOAuthLink(
  db: Database,
  userId: string,
  accountData: OAuthAccountData,
): Promise<void> {
  const existingAccount = await db.query.oauthAccounts.findFirst({
    where: {
      providerId: accountData.providerId,
      providerUserId: accountData.providerUserId,
    },
  });

  if (existingAccount !== undefined && existingAccount !== null) {
    if (existingAccount.userId === userId) {
      // Already linked to this user, just update tokens
      await db
        .update(oauthAccounts)
        .set({
          accessToken: accountData.accessToken,
          refreshToken: accountData.refreshToken,
          tokenExpiresAt: accountData.tokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(oauthAccounts.id, existingAccount.id));
    } else {
      // Linked to different user
      throw new AccountLinkError(
        'This account is already linked to another user',
        'ACCOUNT_ALREADY_LINKED'
      );
    }
  } else {
    // Link account to current user
    await db.insert(oauthAccounts).values({
      id: generateId(),
      ...accountData,
      userId,
    });

    // Mark user as non-anonymous
    await db.update(users).set({ isAnonymous: false }).where(eq(users.id, userId));
  }
}

export { handleOAuthLogin, handleOAuthLink };
export type { OAuthAccountData };
