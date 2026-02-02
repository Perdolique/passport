import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setSessionCookie,
  setOAuthStateCookies,
  getOAuthStateCookies,
  clearOAuthStateCookies,
  getSessionToken,
  clearSessionCookie,
} from '../cookies';
import type { Context } from 'hono';
import type { AppContext } from '../../types';
import { setCookie as honoCookie, getCookie as honoGetCookie, deleteCookie as honoDeleteCookie } from 'hono/cookie';

vi.mock('hono/cookie', () => {
  return {
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    deleteCookie: vi.fn(),
  };
});

describe('cookies', () => {
  let mockContext: Context<AppContext> = undefined as unknown as Context<AppContext>;
  let mockReqHeader: ReturnType<typeof vi.fn> = vi.fn();

  beforeEach(() => {
    mockReqHeader = vi.fn();

    mockContext = {
      req: {
        header: mockReqHeader,
      },
    } as unknown as Context<AppContext>;
    vi.clearAllMocks();
  });

  describe(setSessionCookie, () => {
    it('should set session cookie with correct options', () => {
      setSessionCookie(mockContext, 'token-123');

      expect(honoCookie).toHaveBeenCalledWith(mockContext, 'session_token', 'token-123', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    });
  });

  describe(setOAuthStateCookies, () => {
    it('should set state and verifier cookies', () => {
      setOAuthStateCookies(mockContext, { state: 'state-123', verifier: 'verifier-456' });

      expect(honoCookie).toHaveBeenCalledWith(mockContext, 'oauth_state', 'state-123', expect.any(Object));
      expect(honoCookie).toHaveBeenCalledWith(mockContext, 'oauth_verifier', 'verifier-456', expect.any(Object));
    });

    it('should set link mode cookie when option is true', () => {
      setOAuthStateCookies(mockContext, { state: 'state-123', verifier: 'verifier-456', linkMode: true });

      expect(honoCookie).toHaveBeenCalledWith(mockContext, 'oauth_link_mode', 'true', expect.any(Object));
    });

    it('should set redirect cookie when provided', () => {
      setOAuthStateCookies(mockContext, { state: 'state-123', verifier: 'verifier-456', redirect: '/dashboard' });

      expect(honoCookie).toHaveBeenCalledWith(mockContext, 'oauth_redirect', '/dashboard', expect.any(Object));
    });
  });

  describe(getOAuthStateCookies, () => {
    it('should return all OAuth cookies', () => {
      vi.mocked(honoGetCookie).mockImplementation((_ctx, name) => {
        if (name === 'oauth_state') {
          return 'state-123';
        }
        if (name === 'oauth_verifier') {
          return 'verifier-456';
        }
        if (name === 'oauth_link_mode') {
          return 'true';
        }
        if (name === 'oauth_redirect') {
          return '/dashboard';
        }
        return undefined;
      });

      const result = getOAuthStateCookies(mockContext);

      expect(result).toEqual({
        state: 'state-123',
        verifier: 'verifier-456',
        linkMode: true,
        redirect: '/dashboard',
      });
    });

    it('should return false for linkMode when cookie is not "true"', () => {
      vi.mocked(honoGetCookie).mockImplementation((_ctx, name) => {
        if (name === 'oauth_link_mode') {
          return 'false';
        }
        return undefined;
      });

      const result = getOAuthStateCookies(mockContext);

      expect(result.linkMode).toBeFalsy();
    });
  });

  describe(clearOAuthStateCookies, () => {
    it('should delete all OAuth cookies', () => {
      clearOAuthStateCookies(mockContext);

      expect(honoDeleteCookie).toHaveBeenCalledWith(mockContext, 'oauth_state');
      expect(honoDeleteCookie).toHaveBeenCalledWith(mockContext, 'oauth_verifier');
      expect(honoDeleteCookie).toHaveBeenCalledWith(mockContext, 'oauth_link_mode');
      expect(honoDeleteCookie).toHaveBeenCalledWith(mockContext, 'oauth_redirect');
    });
  });

  describe(getSessionToken, () => {
    it('should return token from cookie', () => {
      vi.mocked(honoGetCookie).mockReturnValue('token-from-cookie');

      const result = getSessionToken(mockContext);

      expect(result).toBe('token-from-cookie');
    });

    it('should return token from Authorization header if cookie not present', () => {
      vi.mocked(honoGetCookie).mockReturnValue(undefined);
      mockReqHeader.mockReturnValue('Bearer token-from-header');

      const result = getSessionToken(mockContext);

      expect(result).toBe('token-from-header');
    });

    it('should return null if no token found', () => {
      vi.mocked(honoGetCookie).mockReturnValue(undefined);
      mockReqHeader.mockReturnValue(undefined);

      const result = getSessionToken(mockContext);

      expect(result).toBeNull();
    });
  });

  describe(clearSessionCookie, () => {
    it('should delete session cookie', () => {
      clearSessionCookie(mockContext);

      expect(honoDeleteCookie).toHaveBeenCalledWith(mockContext, 'session_token');
    });
  });
});
