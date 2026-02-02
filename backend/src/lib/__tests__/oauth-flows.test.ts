import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOAuthLogin, handleOAuthLink, type OAuthAccountData } from '../oauth-flows';
import { AccountLinkError } from '../account-link-error';
import type { Database } from '../../db/client';
import { generateId } from '../crypto';

vi.mock('../crypto', async () => {
  const actual = await vi.importActual('../crypto');
  return {
    ...actual,
    generateId: vi.fn(),
  };
});

describe('oauth-flows', () => {
  let mockDb: Database = undefined as unknown as Database;
  let mockInsert: ReturnType<typeof vi.fn> = vi.fn();
  let mockUpdate: ReturnType<typeof vi.fn> = vi.fn();
  let mockFindFirst: ReturnType<typeof vi.fn> = vi.fn();

  beforeEach(() => {
    mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindFirst = vi.fn();

    mockDb = {
      insert: mockInsert,
      update: mockUpdate,
      query: {
        oauthAccounts: {
          findFirst: mockFindFirst,
        },
      },
    } as unknown as Database;

    vi.clearAllMocks();
  });

  const mockAccountData: OAuthAccountData = {
    providerId: 'twitch',
    providerUserId: 'twitch-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: new Date('2026-03-04T00:00:00Z'),
  };

  describe(handleOAuthLogin, () => {
    it('should update tokens and return existing user ID if account exists', async () => {
      const existingAccount = {
        id: 'oauth-acc-123',
        userId: 'user-existing',
        providerId: 'twitch',
        providerUserId: 'twitch-123',
      };

      mockFindFirst.mockResolvedValue(existingAccount);

      const result = await handleOAuthLogin(mockDb, mockAccountData);

      expect(result).toBe('user-existing');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should create new user and account if account does not exist', async () => {
      mockFindFirst.mockResolvedValue(null);
      vi.mocked(generateId).mockReturnValueOnce('user-new').mockReturnValueOnce('oauth-acc-new');

      const result = await handleOAuthLogin(mockDb, mockAccountData);

      expect(result).toBe('user-new');
      // users + oauthAccounts
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe(handleOAuthLink, () => {
    it('should update tokens if account already linked to same user', async () => {
      const userId = 'user-123';
      const existingAccount = {
        id: 'oauth-acc-123',
        userId: 'user-123',
        providerId: 'twitch',
        providerUserId: 'twitch-123',
      };

      mockFindFirst.mockResolvedValue(existingAccount);

      await handleOAuthLink(mockDb, userId, mockAccountData);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw error if account linked to different user', async () => {
      const userId = 'user-123';
      const existingAccount = {
        id: 'oauth-acc-123',
        userId: 'user-different',
        providerId: 'twitch',
        providerUserId: 'twitch-123',
      };

      mockFindFirst.mockResolvedValue(existingAccount);

      await expect(handleOAuthLink(mockDb, userId, mockAccountData)).rejects.toThrow(
        'This account is already linked to another user',
      );
    });

    it('should create new link and mark user as non-anonymous if account not linked', async () => {
      const userId = 'user-123';
      mockFindFirst.mockResolvedValue(null);
      vi.mocked(generateId).mockReturnValue('oauth-acc-new');

      await handleOAuthLink(mockDb, userId, mockAccountData);

      // oauthAccounts
      expect(mockInsert).toHaveBeenCalled();
      // users - mark as non-anonymous
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should have error code ACCOUNT_ALREADY_LINKED when account linked to different user', async () => {
      const userId = 'user-123';
      const existingAccount = {
        id: 'oauth-acc-123',
        userId: 'user-different',
        providerId: 'twitch',
        providerUserId: 'twitch-123',
      };

      mockFindFirst.mockResolvedValue(existingAccount);

      try {
        await handleOAuthLink(mockDb, userId, mockAccountData);
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(AccountLinkError);
        expect((error as AccountLinkError).code).toBe('ACCOUNT_ALREADY_LINKED');
      }
    });
  });
});
