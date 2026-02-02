/**
 * Error thrown when account linking fails
 */
export class AccountLinkError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = 'AccountLinkError';
		this.code = code;
	}
}
