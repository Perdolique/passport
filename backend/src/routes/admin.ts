import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { AppContext, AuthProviderId } from '../types';
import { authProviders, AUTH_PROVIDER_IDS } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';

const admin = new Hono<AppContext>();

// Apply authentication and admin middleware to all admin routes
admin.use('*', requireAuth());
admin.use('*', requireAdmin());

/**
 * GET /admin/auth-providers
 * Get list of all authentication providers with their status
 */
admin.get('/auth-providers', async (c) => {
  const db = c.get('db');

  const providers = await db.query.authProviders.findMany({
    columns: {
      id: true,
      name: true,
      type: true,
      isActive: true,
    },
  });

  return c.json({ providers });
});

/**
 * PATCH /admin/auth-providers/:id
 * Toggle authentication provider active status
 */
admin.patch('/auth-providers/:id', async (c) => {
  const db = c.get('db');
  const providerId = c.req.param('id') as AuthProviderId;

  // Validate provider ID
  if (!AUTH_PROVIDER_IDS.includes(providerId)) {
    return c.json({ error: 'Invalid provider ID' }, 400);
  }

  // Get request body
  const body = await c.req.json<{ isActive: boolean }>();

  if (typeof body.isActive !== 'boolean') {
    return c.json({ error: 'isActive must be a boolean' }, 400);
  }

  // Update provider status
  const result = await db
    .update(authProviders)
    .set({
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(eq(authProviders.id, providerId))
    .returning();

  if (result.length === 0) {
    return c.json({ error: 'Provider not found' }, 404);
  }

  return c.json({
    provider: {
      id: result[0].id,
      name: result[0].name,
      type: result[0].type,
      isActive: result[0].isActive,
    },
  });
});

export { admin };
