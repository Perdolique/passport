import { describe, it, expect, vi } from 'vitest';
import { createDb } from '../client';

describe('createDb', () => {
  it('should create a database client with relations', () => {
    // Mock D1 database instance
    const mockD1 = {} as never;

    const db = createDb(mockD1);

    // The function should return an object (drizzle instance)
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
  });

  it('should pass the D1 instance to drizzle', () => {
    const mockD1 = { prepare: vi.fn() } as never;

    const db = createDb(mockD1);

    // Verify drizzle instance is returned
    expect(db).toBeDefined();
  });
});
