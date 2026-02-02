import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { sessions } from '../db/schema';
import { generateId, generateRandomString, hashString, createExpirationDate } from './crypto';

const SESSION_DURATION_DAYS = 30;

interface SessionResult {
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Create a new session for a user
 * @param db - Database instance
 * @param userId - User ID to create session for
 * @returns Session token, ID, and expiration date
 */
async function createSession(db: Database, userId: string): Promise<SessionResult> {
  const sessionToken = generateRandomString(32);
  const tokenHash = await hashString(sessionToken);
  const sessionId = generateId();
  const expiresAt = createExpirationDate(SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    id: sessionId,
    tokenHash,
    userId,
    expiresAt,
  });

  return { sessionToken, sessionId, expiresAt };
}

/**
 * Validate a session token and return the session with user data
 * @param db - Database instance
 * @param sessionToken - Session token to validate
 * @returns Session with user data, or null if invalid/expired
 */
async function validateSessionToken(db: Database, sessionToken: string) {
  const tokenHash = await hashString(sessionToken);

  const session = await db.query.sessions.findFirst({
    where: { tokenHash },
    with: {
      user: {
        with: {
          oauthAccounts: {
            where: { providerId: 'twitch' },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  return session;
}

/**
 * Delete a session by token hash
 * @param db - Database instance
 * @param sessionToken - Session token to delete
 */
async function deleteSession(db: Database, sessionToken: string): Promise<void> {
  const tokenHash = await hashString(sessionToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export { createSession, validateSessionToken, deleteSession, SESSION_DURATION_DAYS };
export type { SessionResult };
