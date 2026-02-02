import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppContext } from './types';
import { createDb } from './db/client';
import { auth } from './routes/auth';
import { oauth } from './routes/oauth';
import { admin } from './routes/admin';

const app = new Hono<AppContext>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());

app.use(
  '*',

  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173'
    ],

    credentials: true,
  })
);

// Initialize database middleware
app.use('*', async (context, next) => {
  const db = createDb(context.env.DB);

  context.set('db', db);

  await next();
});

// Health check
app.get('/', (context) => context.json({
    name: 'passport',
    version: '0.0.1',
    status: 'ok',
  }));

// Mount auth routes
app.route('/auth', auth);

// Mount OAuth2 provider routes
app.route('/oauth', oauth);

// Mount admin routes
app.route('/admin', admin);

// 404 handler
app.notFound((context) => context.json({ error: 'Not found' }, 404));

// Error handler
  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  app.onError((err, context) => {
  // oxlint-disable-next-line no-console
  console.error('Unhandled error:', err);

  return context.json({ error: 'Internal server error' }, 500);
});

// oxlint-disable-next-line import/no-default-export
export default app;
