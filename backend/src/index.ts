import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import { createMiddleware } from 'hono/factory'
import type { AppContext } from './types'
import { createHttpDb, createWsDb } from './db/client'
import { auth } from './routes/auth'
import { oauth } from './routes/oauth'
import { admin } from './routes/admin'
import { cleanupExpiredAuthData } from './lib/cleanup'
import { getAllowedOrigins, isOriginAllowed } from './lib/origins'
import { requireTrustedOrigin } from './middleware/csrf'

const app = new Hono<AppContext>()
const injectDatabaseClients = createMiddleware<AppContext>(async (context, next) => {
  const dbHttp = createHttpDb(context.env.DATABASE_URL)
  const dbWs = createWsDb(context.env.DATABASE_URL)

  context.set('dbHttp', dbHttp)
  context.set('dbWs', dbWs)

  await next()
})

// Global middlewares
app.use(logger())
app.use(secureHeaders())

app.use(
  cors({
    origin: (origin, context) => {
      if (origin === '') {
        return ''
      }

      const allowedOrigins = getAllowedOrigins(context.env)
      const originAllowed = isOriginAllowed(allowedOrigins, origin)

      if (!originAllowed) {
        return ''
      }

      return origin
    },
    credentials: true,
    allowHeaders: [
      'Authorization',
      'Content-Type',
    ],
    allowMethods: [
      'DELETE',
      'GET',
      'PATCH',
      'POST',
      'OPTIONS',
    ],
  }),
)

app.use(requireTrustedOrigin)
app.use(injectDatabaseClients)

// Health check
app.get('/', (context) => context.json({
  status: 'ok',
}))

// Mount auth routes
app.route('/auth', auth)

// Mount OAuth2 provider routes
app.route('/oauth', oauth)

// Mount admin routes
app.route('/admin', admin)

// 404 handler
app.notFound((context) => context.json({ error: 'Not found' }, 404))

// Error handler
// oxlint-disable-next-line promise/prefer-await-to-callbacks
app.onError((err, context) => {
  // oxlint-disable-next-line no-console
  console.error('Unhandled error:', err)

  return context.json({ error: 'Internal server error' }, 500)
})

async function runScheduledCleanup(env: Env): Promise<void> {
  const dbHttp = createHttpDb(env.DATABASE_URL)
  const result = await cleanupExpiredAuthData(dbHttp)

  // oxlint-disable-next-line no-console
  console.log('Scheduled cleanup completed', result)
}

const worker = {
  fetch: app.fetch,
  scheduled: (_controller: ScheduledController, env: Env, executionContext: ExecutionContext) => {
    executionContext.waitUntil(runScheduledCleanup(env))
  },
}

// oxlint-disable-next-line import/no-default-export
export default worker
