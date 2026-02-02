import * as v from 'valibot';
import type { AuthProviderId } from '../types';

/**
 * Schema for validating auth provider ID route parameter
 */
const AuthProviderIdParamSchema = v.picklist(['twitch', 'anonymous'] satisfies AuthProviderId[]);

/**
 * Schema for validating admin provider update request body
 */
const UpdateProviderBodySchema = v.object({
	isActive: v.boolean(),
});

/**
 * Type for validated update provider request body
 */
export type UpdateProviderBody = v.InferOutput<typeof UpdateProviderBodySchema>;

export { AuthProviderIdParamSchema, UpdateProviderBodySchema };
