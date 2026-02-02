import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  generateId,
  hashString,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  createExpirationDate,
} from '../crypto';

describe(generateRandomString, () => {
  it('should generate a string of correct length (hex encoded)', () => {
    const result = generateRandomString(16);
    // 16 bytes = 32 hex characters
    expect(result).toHaveLength(32);
  });

  it('should generate different strings on each call', () => {
    const result1 = generateRandomString(16);
    const result2 = generateRandomString(16);
    expect(result1).not.toBe(result2);
  });

  it('should only contain valid hex characters', () => {
    const result = generateRandomString(32);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe(generateId, () => {
  it('should generate a valid UUID v4 format', () => {
    const result = generateId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(result).toMatch(uuidRegex);
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe(hashString, () => {
  it('should return a 64 character hex string (SHA-256)', async () => {
    const result = await hashString('test');
    expect(result).toHaveLength(64);
  });

  it('should produce consistent hashes for same input', async () => {
    const hash1 = await hashString('hello world');
    const hash2 = await hashString('hello world');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await hashString('hello');
    const hash2 = await hashString('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should only contain valid hex characters', async () => {
    const result = await hashString('test input');
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe(generateCodeVerifier, () => {
  it('should generate a base64url encoded string', () => {
    const result = generateCodeVerifier();
    // Base64URL: only a-z, A-Z, 0-9, -, _
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should generate a string of appropriate length (43+ characters for PKCE)', () => {
    const result = generateCodeVerifier();
    expect(result.length).toBeGreaterThanOrEqual(43);
  });

  it('should generate different verifiers on each call', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
});

describe(generateCodeChallenge, () => {
  it('should generate a base64url encoded challenge', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // Base64URL: only a-z, A-Z, 0-9, -, _
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should produce consistent challenges for same verifier', async () => {
    const verifier = 'test-verifier-string-that-is-long-enough';
    const challenge1 = await generateCodeChallenge(verifier);
    const challenge2 = await generateCodeChallenge(verifier);
    expect(challenge1).toBe(challenge2);
  });

  it('should produce different challenges for different verifiers', async () => {
    const challenge1 = await generateCodeChallenge('verifier-one-test');
    const challenge2 = await generateCodeChallenge('verifier-two-test');
    expect(challenge1).not.toBe(challenge2);
  });
});

describe(verifyCodeChallenge, () => {
  it('should return true for valid S256 challenge', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    const result = await verifyCodeChallenge(verifier, challenge, 'S256');
    expect(result).toBeTruthy();
  });

  it('should return false for invalid S256 challenge', async () => {
    const verifier = generateCodeVerifier();
    const wrongChallenge = 'wrong-challenge-value';

    const result = await verifyCodeChallenge(verifier, wrongChallenge, 'S256');
    expect(result).toBeFalsy();
  });

  it('should return true for valid plain challenge', async () => {
    const verifier = 'test-verifier-plain';

    const result = await verifyCodeChallenge(verifier, verifier, 'plain');
    expect(result).toBeTruthy();
  });

  it('should return false for invalid plain challenge', async () => {
    const verifier = 'test-verifier-plain';
    const wrongChallenge = 'wrong-verifier';

    const result = await verifyCodeChallenge(verifier, wrongChallenge, 'plain');
    expect(result).toBeFalsy();
  });

  it('should return false for unsupported method', async () => {
    const verifier = 'test-verifier';
    const challenge = 'some-challenge';

    const result = await verifyCodeChallenge(verifier, challenge, 'unsupported');
    expect(result).toBeFalsy();
  });
});

describe(createExpirationDate, () => {
  it('should return a Date object', () => {
    const result = createExpirationDate(7);
    expect(result).toBeInstanceOf(Date);
  });

  it('should return a date in the future', () => {
    const now = new Date();
    const result = createExpirationDate(1);
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it('should add correct number of days', () => {
    const now = new Date();
    const days = 30;
    const result = createExpirationDate(days);

    const expectedTime = now.getTime() + days * 24 * 60 * 60 * 1000;
    // Allow 1 second tolerance for test execution time
    expect(Math.abs(result.getTime() - expectedTime)).toBeLessThan(1000);
  });
});
