import type { H3Event } from 'h3'

/**
 * Admin API proxy endpoints
 * Forwards requests to backend passport admin routes
 */
export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
  const path = getRouterParam(event, '_')
  const method = event.method
  const query = getQuery(event)

  // Build target URL
  const targetUrl = new URL(`/admin/${path || ''}`, config.authServiceUrl)

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
  })

  // Forward Set-Cookie headers
  const setCookie = response.headers.getSetCookie()
  if (setCookie.length > 0) {
    for (const cookie of setCookie) {
      appendResponseHeader(event, 'set-cookie', cookie)
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
