import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import type { AppContext } from '../types';
import { authProviders } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { AuthProviderIdParamSchema, UpdateProviderBodySchema } from '../lib/validation';

const admin = new Hono<AppContext>();

// Apply authentication and admin middleware to all admin routes
admin.use('*', requireAuth());
admin.use('*', requireAdmin());

/**
 * GET /admin/auth-providers
 * Get list of all authentication providers with their status
 */
admin.get('/auth-providers', async (context) => {
  const db = context.get('db');

  const providers = await db.query.authProviders.findMany({
    columns: {
      id: true,
      name: true,
      type: true,
      isActive: true,
    },
  });

  return context.json({ providers });
});

/**
 * PATCH /admin/auth-providers/:id
 * Toggle authentication provider active status
 */
admin.patch('/auth-providers/:id', async (context) => {
  const db = context.get('db');

  // Validate provider ID
  const providerIdResult = v.safeParse(AuthProviderIdParamSchema, context.req.param('id'));
  if (!providerIdResult.success) {
    return context.json({ error: 'Invalid provider ID' }, 400);
  }
  const providerId = providerIdResult.output;

  // Get and validate request body
  const bodyResult = v.safeParse(UpdateProviderBodySchema, await context.req.json());
  if (!bodyResult.success) {
    return context.json({ error: 'Invalid request body: isActive must be a boolean' }, 400);
  }
  const { isActive } = bodyResult.output;

  // Update provider status
  const result = await db
    .update(authProviders)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(authProviders.id, providerId))
    .returning();

  if (result.length === 0) {
    return context.json({ error: 'Provider not found' }, 404);
  }

  return context.json({
    provider: {
      id: result[0].id,
      name: result[0].name,
      type: result[0].type,
      isActive: result[0].isActive,
    },
  });
});

export { admin };
