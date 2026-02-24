import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import type { AppContext } from '@/types'
import { getAllowedOrigins, isOriginAllowed } from '@/lib/origins'
// import { createMiddleware } from 'hono/factory'
// import { createHttpDb, createWsDb } from './db/client'
// import { auth } from './routes/auth'
// import { oauth } from './routes/oauth'
// import { admin } from './routes/admin'
// import { cleanupExpiredAuthData } from './lib/cleanup'
// import { requireTrustedOrigin } from './middleware/csrf'

const app = new Hono<AppContext>()

// const injectDatabaseClients = createMiddleware<AppContext>(async (context, next) => {
//   const dbHttp = createHttpDb(context.env.DATABASE_URL)
//   const dbWs = createWsDb(context.env.DATABASE_URL)

//   context.set('dbHttp', dbHttp)
//   context.set('dbWs', dbWs)

//   await next()
// })

// Global middlewares
app.use(secureHeaders())

app.use(
  cors({
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

    // Dynamically determine allowed origins based on the request and environment configuration
    origin(origin, context) {
      const allowedOrigins = getAllowedOrigins(context.env)
      const originAllowed = isOriginAllowed(allowedOrigins, origin)

      if (originAllowed) {
        return origin
      }

      return ''
    }
  })
)

// app.use(requireTrustedOrigin)
// app.use(injectDatabaseClients)

// // Health check
// app.get('/', (context) => context.json({
//   status: 'ok',
// }))

// // Mount auth routes
// app.route('/auth', auth)

// // Mount OAuth2 provider routes
// app.route('/oauth', oauth)

// // Mount admin routes
// app.route('/admin', admin)

// // 404 handler
// app.notFound((context) => context.json({ error: 'Not found' }, 404))

// // Error handler
// // oxlint-disable-next-line promise/prefer-await-to-callbacks
// app.onError((err, context) => {
//   // oxlint-disable-next-line no-console
//   console.error('Unhandled error:', err)

//   return context.json({ error: 'Internal server error' }, 500)
// })

// async function runScheduledCleanup(env: Env): Promise<void> {
//   const dbHttp = createHttpDb(env.DATABASE_URL)
//   const result = await cleanupExpiredAuthData(dbHttp)

//   // oxlint-disable-next-line no-console
//   console.log('Scheduled cleanup completed', result)
// }

export default app
