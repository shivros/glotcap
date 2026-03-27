/**
 * Client-side HTTP utilities
 *
 * Error handling and fetch wrapper for browser/client use.
 */
import type { z } from 'zod'

/**
 * API error with status code.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Options for apiFetch with optional schema validation.
 */
export interface ApiFetchOptions<T> extends RequestInit {
  /** Zod schema for validating the response. If provided, response will be validated. */
  schema?: z.ZodType<T>
}

/**
 * Type-safe fetch wrapper with error handling and optional schema validation.
 *
 * @param url - The URL to fetch
 * @param options - Request options, optionally including a Zod schema for validation
 * @throws {ApiError} On non-2xx responses
 * @throws {Error} On schema validation failure (if schema provided)
 *
 * @example
 * // Without validation (unsafe - use for backwards compatibility)
 * const data = await apiFetch<{ name: string }>('/api/user')
 *
 * @example
 * // With validation (recommended)
 * const UserSchema = z.object({ name: z.string() })
 * const data = await apiFetch('/api/user', { schema: UserSchema })
 */
export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions<T>,
): Promise<T> {
  const { schema, ...fetchOptions } = options ?? {}

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const body = (await response.json()) as Record<string, unknown>
      message = (body.message ?? body.error ?? message) as string
    } catch {
      // Use status text if JSON parsing fails
    }
    throw new ApiError(message, response.status)
  }

  const data = await response.json()

  // Validate with schema if provided
  if (schema) {
    const result = schema.safeParse(data)
    if (!result.success) {
      const issues = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; ')
      throw new Error(`API response validation failed: ${issues}`)
    }
    return result.data
  }

  // Fallback to unsafe cast for backwards compatibility
  return data as T
}

/**
 * Extract a readable error message from unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unexpected error occurred'
}
