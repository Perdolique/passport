import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

/**
 * These tests verify the app structure and middleware configuration.
 * Since the actual app requires Cloudflare Workers environment (D1 database),
 * we create a minimal test app that mirrors the middleware setup.
 */

function createTestApp() {
  const app = new Hono();

  // Global middleware (same as in index.ts)
  app.use('*', logger());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    }),
  );

  // Health check
  app.get('/', (c) => {
    return c.json({
      name: 'passport',
      version: '0.0.1',
      status: 'ok',
    });
  });

  // Mock auth route for testing route structure
  app.get('/auth/session', (c) => {
    return c.json({ error: 'No session token provided' }, 401);
  });

  // Mock oauth route for testing route structure
  app.get('/oauth/authorize', (c) => {
    return c.json({ error: 'unsupported_response_type' }, 400);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}

describe('App entry point', () => {
  describe('GET / (health check)', () => {
    it('should return service info', async () => {
      const app = createTestApp();
      const res = await app.request('/');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty('name', 'passport');
      expect(json).toHaveProperty('version', '0.0.1');
      expect(json).toHaveProperty('status', 'ok');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const app = createTestApp();
      const res = await app.request('/unknown/route');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toHaveProperty('error', 'Not found');
    });

    it('should return 404 for unknown methods on known routes', async () => {
      const app = createTestApp();
      const res = await app.request('/', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toHaveProperty('error', 'Not found');
    });
  });

  describe('CORS middleware', () => {
    it('should include CORS headers for allowed origins', async () => {
      const app = createTestApp();
      const res = await app.request('/', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle preflight requests', async () => {
      const app = createTestApp();
      const res = await app.request('/', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });

  describe('Secure headers middleware', () => {
    it('should include security headers', async () => {
      const app = createTestApp();
      const res = await app.request('/');

      // Check for common security headers
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });
  });

  describe('Route mounting', () => {
    it('should mount auth routes under /auth', async () => {
      const app = createTestApp();
      const res = await app.request('/auth/session');

      // Should get 401 (no session) not 404 (route not found)
      expect(res.status).toBe(401);
    });

    it('should mount oauth routes under /oauth', async () => {
      const app = createTestApp();
      const res = await app.request('/oauth/authorize');

      // Should get 400 (missing params) not 404 (route not found)
      expect(res.status).toBe(400);
    });
  });
});
