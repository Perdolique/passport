import { describe, expect, test } from 'vitest'
import app from '../index'

const MOCK_ENV = {
  FRONTEND_URL: 'https://app.example.com',
  CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
}

describe('app instance', () => {
  test('GET / returns 404', async () => {
    const res = await app.request('/', {}, MOCK_ENV)

    expect(res.status).toBe(404)
  })
})
