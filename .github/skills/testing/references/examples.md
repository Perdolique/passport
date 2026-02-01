# Test Examples

## Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

## Testing Async Functions

```typescript
describe('hashString', () => {
  it('should return a 64 character hex string (SHA-256)', async () => {
    const result = await hashString('test');
    expect(result).toHaveLength(64);
  });

  it('should produce consistent hashes for same input', async () => {
    const hash1 = await hashString('hello world');
    const hash2 = await hashString('hello world');
    expect(hash1).toBe(hash2);
  });
});
```

## Testing Uniqueness

```typescript
describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});
```

## Testing with Regex Patterns

```typescript
describe('generateId', () => {
  it('should generate a valid UUID v4 format', () => {
    const result = generateId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(result).toMatch(uuidRegex);
  });
});
```

## Testing with Test Fixtures

```typescript
describe('buildTwitchAuthUrl', () => {
  const baseParams = {
    clientId: 'test-client-id',
    redirectUri: 'https://example.com/callback',
    state: 'random-state-123',
    codeChallenge: 'test-code-challenge',
  };

  it('should build a valid URL with required parameters', () => {
    const url = buildTwitchAuthUrl(baseParams);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://id.twitch.tv');
    expect(parsed.pathname).toBe('/oauth2/authorize');
  });

  it('should allow custom scopes', () => {
    const url = buildTwitchAuthUrl({
      ...baseParams,
      scopes: ['user:read:email', 'channel:read:subscriptions'],
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get('scope')).toBe('user:read:email channel:read:subscriptions');
  });
});
```

## Testing Numeric Tolerances

```typescript
describe('createExpirationDate', () => {
  it('should add correct number of days', () => {
    const now = new Date();
    const days = 30;
    const result = createExpirationDate(days);

    const expectedTime = now.getTime() + days * 24 * 60 * 60 * 1000;
    // Allow 1 second tolerance for test execution time
    expect(Math.abs(result.getTime() - expectedTime)).toBeLessThan(1000);
  });
});
```
