/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random UUID v4
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Hash a string using SHA-256
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a PKCE code verifier (43-128 characters)
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate a PKCE code challenge from a verifier using S256 method
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Base64 URL-safe encoding (no padding)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCodePoint(...buffer));
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/**
 * Verify PKCE code challenge against code verifier
 */
async function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: string
): Promise<boolean> {
  if (method === 'plain') {
    return verifier === challenge;
  }

  if (method === 'S256') {
    const expectedChallenge = await generateCodeChallenge(verifier);
    return expectedChallenge === challenge;
  }

  return false;
}

/**
 * Create an expiration date from now
 */
function createExpirationDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export { generateRandomString, generateId, hashString, generateCodeVerifier, generateCodeChallenge, verifyCodeChallenge, createExpirationDate };
