import { describe, expect, test } from 'vitest'
import { getAllowedOrigins, isOriginAllowed } from '../origins'

describe(getAllowedOrigins, () => {
  test('returns FRONTEND_URL combined with CORS_ALLOWED_ORIGINS', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com,https://api.example.com',
    }

    const result = getAllowedOrigins(env)

    expect(result).toEqual([
      'https://admin.example.com',
      'https://api.example.com',
      'https://app.example.com',
    ])
  })

  test('deduplicates FRONTEND_URL if it is already in CORS_ALLOWED_ORIGINS', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com',
    }

    const result = getAllowedOrigins(env)

    expect(result).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ])
  })

  test('trims whitespace around origins in CORS_ALLOWED_ORIGINS', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
      CORS_ALLOWED_ORIGINS: '  https://admin.example.com  ,  https://api.example.com  ',
    }

    const result = getAllowedOrigins(env)

    expect(result).toEqual([
      'https://admin.example.com',
      'https://api.example.com',
      'https://app.example.com',
    ])
  })

  test('skips empty entries in CORS_ALLOWED_ORIGINS', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com,,https://api.example.com',
    }

    const result = getAllowedOrigins(env)

    expect(result).toEqual([
      'https://admin.example.com',
      'https://api.example.com',
      'https://app.example.com',
    ])
  })

  test('throws if FRONTEND_URL is missing', () => {
    const env = {
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
    }

    expect(() => getAllowedOrigins(env)).toThrow('Invalid environment variable FRONTEND_URL')
  })

  test('throws if FRONTEND_URL is an empty string', () => {
    const env = {
      FRONTEND_URL: '',
      CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
    }

    expect(() => getAllowedOrigins(env)).toThrow('Invalid environment variable FRONTEND_URL')
  })

  test('throws if CORS_ALLOWED_ORIGINS is missing', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
    }

    expect(() => getAllowedOrigins(env)).toThrow('Invalid environment variable CORS_ALLOWED_ORIGINS')
  })

  test('throws if CORS_ALLOWED_ORIGINS is an empty string', () => {
    const env = {
      FRONTEND_URL: 'https://app.example.com',
      CORS_ALLOWED_ORIGINS: '',
    }

    expect(() => getAllowedOrigins(env)).toThrow('Invalid environment variable CORS_ALLOWED_ORIGINS')
  })
})

describe(isOriginAllowed, () => {
  test('returns true for an origin that is in the list', () => {
    const allowedOrigins = ['https://app.example.com', 'https://admin.example.com']

    expect(isOriginAllowed(allowedOrigins, 'https://app.example.com')).toBeTruthy()
  })

  test('returns false for an origin that is not in the list', () => {
    const allowedOrigins = ['https://app.example.com', 'https://admin.example.com']

    expect(isOriginAllowed(allowedOrigins, 'https://evil.example.com')).toBeFalsy()
  })
})
