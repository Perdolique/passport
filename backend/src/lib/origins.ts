import * as v from 'valibot'

/** Retrieves a string value from the environment variables, ensuring it is non-empty and properly trimmed. */
function getEnvString(rawEnv: unknown, key: string): string {
  const schema = v.pipe(
    v.object({
      [key]: v.unknown()
    }),

    v.transform(result => result[key]),

    v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty()
    )
  )

  const result = v.safeParse(schema, rawEnv)

  if (result.success === false) {
    throw new Error(`Invalid environment variable ${key}: ${result.issues.map(issue => issue.message).join(', ')}`)
  }

  return result.output
}

/** Converts a comma-separated string of origins into a set of trimmed, non-empty origins. */
function toOriginList(originsString: string) : Set<string> {
  const rawOrigins = originsString.split(',')
  const result = new Set<string>()

  for (const origin of rawOrigins) {
    const trimmedOrigin = origin.trim()

    if (trimmedOrigin !== '') {
      result.add(trimmedOrigin)
    }
  }

  return result
}


/** Retrieves the allowed origins from the environment variables and returns them as an array of strings. */
function getAllowedOrigins(rawEnv: unknown) : string[] {
  const frontendUrl = getEnvString(rawEnv, 'FRONTEND_URL')
  const corsOriginsString = getEnvString(rawEnv, 'CORS_ALLOWED_ORIGINS')
  const originsList = toOriginList(corsOriginsString)

  originsList.add(frontendUrl)

  return [...originsList]
}

/** Checks if the given origin is included in the list of allowed origins. */
function isOriginAllowed(allowedOrigins: string[], origin: string): boolean {
  return allowedOrigins.includes(origin)
}

export {
  getAllowedOrigins,
  isOriginAllowed,
}
