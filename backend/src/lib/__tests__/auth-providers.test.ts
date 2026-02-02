import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isProviderActive } from '../auth-providers';
import type { Database } from '../../db/client';

describe('auth-providers', () => {
  let mockDb: Database = undefined as unknown as Database;
  let mockFindFirst: ReturnType<typeof vi.fn> = vi.fn();

  beforeEach(() => {
    mockFindFirst = vi.fn();

    mockDb = {
      query: {
        authProviders: {
          findFirst: mockFindFirst,
        },
      },
    } as unknown as Database;

    vi.clearAllMocks();
  });

  describe(isProviderActive, () => {
    it('should return true if provider is active', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'twitch',
        isActive: true,
      });

      const result = await isProviderActive(mockDb, 'twitch');

      expect(result).toBeTruthy();
    });

    it('should return false if provider is inactive', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'anonymous',
        isActive: false,
      });

      const result = await isProviderActive(mockDb, 'anonymous');

      expect(result).toBeFalsy();
    });

    it('should return false if provider not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await isProviderActive(mockDb, 'twitch');

      expect(result).toBeFalsy();
    });
  });
});
