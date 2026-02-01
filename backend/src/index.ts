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
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB);

  c.set('db', db);

  await next();
});

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'passport',
    version: '0.0.1',
    status: 'ok',
  });
});

// Mount auth routes
app.route('/auth', auth);

// Mount OAuth2 provider routes
app.route('/oauth', oauth);

// Mount admin routes
app.route('/admin', admin);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
