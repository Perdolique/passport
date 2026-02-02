/**
 * Error thrown during OAuth flow failures
 */
export class OAuthError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = 'OAuthError';
		this.code = code;
	}
}
