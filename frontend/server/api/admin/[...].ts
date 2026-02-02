import {
  type H3Event,
  appendResponseHeader,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  readRawBody,
  setResponseStatus
} from 'h3'

import { useRuntimeConfig } from 'nitropack/runtime'

/**
 * Admin API proxy endpoints
 * Forwards requests to backend passport admin routes
 */
export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig(event)
  const path = getRouterParam(event, '_')
  const {method} = event
  const query = getQuery(event)

  // Build target URL
  const targetUrl = new URL(`/admin/${path ?? ''}`, config.authServiceUrl)

  // Forward query params
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      targetUrl.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
  }

  // Build headers to forward
  const headers: HeadersInit = {}

  const cookie = getHeader(event, 'cookie')
  if (cookie !== null && cookie !== undefined && cookie !== '') {
    headers['cookie'] = cookie
  }

  const contentType = getHeader(event, 'content-type')
  if (contentType !== null && contentType !== undefined && contentType !== '') {
    headers['content-type'] = contentType
  }

  // Read body for non-GET requests
  // oxlint-disable-next-line init-declarations
  let body: BodyInit | undefined;

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
  const isJson = contentTypeResponse?.includes('application/json')
  if (isJson === true) {
    return response.json() as unknown
  }

  return response.text()
})
