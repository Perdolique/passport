import type { H3Event } from 'h3'

/**
 * Proxy handler for passport API.
 * Forwards all /api/auth/* requests to the passport backend,
 * preserving cookies and handling redirects.
 */
export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
  const path = getRouterParam(event, '_')
  const method = event.method
  const query = getQuery(event)

  // Build target URL
  const targetUrl = new URL(`/auth/${path}`, config.authServiceUrl)

  // Forward query params
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      targetUrl.searchParams.set(key, String(value))
    }
  }

  // Build headers to forward
  const headers: HeadersInit = {}

  const cookie = getHeader(event, 'cookie')
  if (cookie) {
    headers['cookie'] = cookie
  }

  const contentType = getHeader(event, 'content-type')
  if (contentType) {
    headers['content-type'] = contentType
  }

  // Read body for non-GET requests
  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readRawBody(event) ?? undefined
  }

  // Make request to passport
  const response = await fetch(targetUrl.toString(), {
    method,
    headers,
    body,
    redirect: 'manual', // Handle redirects manually
  })

  // Forward Set-Cookie headers
  const setCookie = response.headers.getSetCookie()
  if (setCookie.length > 0) {
    for (const cookie of setCookie) {
      appendResponseHeader(event, 'set-cookie', cookie)
    }
  }

  // Handle redirects
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      // If redirecting to external OAuth provider, forward the redirect
      if (location.startsWith('http')) {
        return sendRedirect(event, location, response.status)
      }

      // Internal redirect - adjust path
      return sendRedirect(event, location.replace('/auth/', '/api/auth/'), response.status)
    }
  }

  // Set response status
  setResponseStatus(event, response.status)

  // Forward response body
  const contentTypeResponse = response.headers.get('content-type')
  if (contentTypeResponse?.includes('application/json')) {
    return response.json()
  }

  return response.text()
})
