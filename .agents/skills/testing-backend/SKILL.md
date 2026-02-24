---
name: testing-backend
description: Unit testing guidelines for passport project (backend). Use when writing tests, creating test files, testing new code, modifying tests, understanding test patterns, ensuring test coverage. Use only for backend testing.
---

# Testing

Unit testing workflow and patterns for Passport authentication service backend.

## Stack

- **Framework**: Vitest
- **Run (use only this command)**: `pnpm test:unit:ci` (from repo root or `backend/`)

## File Conventions

- Test files live in `__tests__/` directories co-located with the source files they test
- Naming: `<source-file-name>.test.ts`
- Example: `src/lib/origins.ts` → `src/lib/__tests__/origins.test.ts`

## Test Structure

Always import from `vitest` directly:

```typescript
import { describe, expect, test } from 'vitest'
```

Use the **function reference** (not a string) as the `describe` label when testing a specific function:

```typescript
import { getAllowedOrigins } from '../origins'

describe(getAllowedOrigins, () => {
  test('returns combined list of origins', () => { ... })
})
```

Use string labels for grouping by entity (e.g., `describe('app instance', ...)`).

## Testing Hono App Routes

Import the app and call `app.request()` with a mock env object:

```typescript
import app from '../index'

const MOCK_ENV = {
  FRONTEND_URL: 'https://app.example.com',
  CORS_ALLOWED_ORIGINS: 'https://admin.example.com',
}

test('GET / returns 404', async () => {
  const res = await app.request('/', {}, MOCK_ENV)

  expect(res.status).toBe(404)
})
```

## Assertion Patterns

| Scenario | Pattern |
|---|---|
| HTTP status code | `expect(res.status).toBe(200)` |
| Array equality | `expect(result).toEqual(['a', 'b'])` |
| Error thrown with message | `expect(() => fn()).toThrow('Invalid environment variable X')` |
| Truthy/falsy boolean | `expect(result).toBeTruthy()` / `.toBeFalsy()` |

## Coverage Expectations

For utility/lib functions, cover:
- Happy path (valid inputs)
- Edge cases (empty strings, duplicates, whitespace)
- Error cases (missing/invalid required inputs — validate the error message)
