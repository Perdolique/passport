import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, validateSessionToken, deleteSession } from '../session';
import type { Database } from '../../db/client';
import { generateRandomString, hashString, generateId, createExpirationDate } from '../crypto';

vi.mock('../crypto', async () => {
  const actual = await vi.importActual('../crypto');

  return {
    ...actual,
    generateRandomString: vi.fn(),
    hashString: vi.fn(),
    generateId: vi.fn(),
    createExpirationDate: vi.fn(),
  };
});

describe('session', () => {
  let mockDb: Database = undefined as unknown as Database;
  let mockInsert: ReturnType<typeof vi.fn> = vi.fn();
  let mockDelete: ReturnType<typeof vi.fn> = vi.fn();
  let mockFindFirst: ReturnType<typeof vi.fn> = vi.fn();

  beforeEach(() => {
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(null),
    });
    mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(null),
    });
    mockFindFirst = vi.fn();

    mockDb = {
      insert: mockInsert,
      delete: mockDelete,
      query: {
        sessions: {
          findFirst: mockFindFirst,
        },
      },
    } as unknown as Database;

    vi.clearAllMocks();
  });

  describe(createSession, () => {
    it('should create a session with valid token and expiration', async () => {
      const userId = 'user-123';
      vi.mocked(generateRandomString).mockReturnValue('token-abc');
      vi.mocked(hashString).mockResolvedValue('hash-abc');
      vi.mocked(generateId).mockReturnValue('session-123');

      const mockDate = new Date('2026-03-04T00:00:00Z');

      vi.mocked(createExpirationDate).mockReturnValue(mockDate);

      const result = await createSession(mockDb, userId);

      expect(result).toEqual({
        sessionToken: 'token-abc',
        sessionId: 'session-123',
        expiresAt: mockDate,
      });

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe(validateSessionToken, () => {
    it('should return session if valid and not expired', async () => {
      const sessionToken = 'valid-token';
      const mockSession = {
        id: 'session-123',
        tokenHash: 'hash-abc',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 1_000_000),
        user: {
          id: 'user-123',
          role: 'user',
          oauthAccounts: [],
        },
      };

      vi.mocked(hashString).mockResolvedValue('hash-abc');
      mockFindFirst.mockResolvedValue(mockSession);

      const result = await validateSessionToken(mockDb, sessionToken);

      expect(result).toEqual(mockSession);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return null if session not found', async () => {
      vi.mocked(hashString).mockResolvedValue('hash-abc');
      mockFindFirst.mockResolvedValue(null);

      const result = await validateSessionToken(mockDb, 'invalid-token');

      expect(result).toBeNull();
    });

    it('should delete expired session and return null', async () => {
      const sessionToken = 'expired-token';
      const mockSession = {
        id: 'session-123',
        tokenHash: 'hash-abc',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 1000),
        user: null,
      };

      vi.mocked(hashString).mockResolvedValue('hash-abc');
      mockFindFirst.mockResolvedValue(mockSession);

      const result = await validateSessionToken(mockDb, sessionToken);

      expect(result).toBeNull();
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe(deleteSession, () => {
    it('should delete session by token hash', async () => {
      const sessionToken = 'token-to-delete';
      vi.mocked(hashString).mockResolvedValue('hash-abc');

      await deleteSession(mockDb, sessionToken);

      expect(hashString).toHaveBeenCalledWith(sessionToken);
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
