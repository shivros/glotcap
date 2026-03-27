import { createError } from 'h3'
import { ZodError } from 'zod'

/**
 * Base application error with HTTP status code.
 * All domain errors should extend this class.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 400 Bad Request - Invalid input or validation failure
 */
export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, 400, code)
    this.name = 'ValidationError'
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, 401, code)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(message, 403, code)
    this.name = 'ForbiddenError'
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code)
    this.name = 'NotFoundError'
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', code = 'RATE_LIMITED') {
    super(message, 429, code)
    this.name = 'RateLimitError'
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code)
    this.name = 'InternalError'
  }
}

/**
 * Convert any error to a standardized JSON Response.
 *
 * @example
 * try {
 *   // ... logic
 * } catch (error) {
 *   return toErrorResponse(error)
 * }
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join('; ')
    return Response.json(
      { error: message, code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  if (error instanceof Error) {
    // Log unexpected errors but don't expose details
    console.error('Unexpected error:', error)
    return Response.json(
      { error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }

  return Response.json(
    { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}

/**
 * Convert various error types to H3 HTTP errors.
 *
 * Handles:
 * - ZodError → 400 Bad Request with validation messages
 * - AppError → Uses error's status and message
 * - Error → Uses fallback status with error message
 * - Unknown → Uses fallback status with generic message
 *
 * @example
 * ```ts
 * export default defineEventHandler(async (event) => {
 *   try {
 *     const data = schema.parse(await readBody(event))
 *     return processData(data)
 *   } catch (error) {
 *     throw toHttpError(error)
 *   }
 * })
 * ```
 */
export function toHttpError(error: unknown, fallbackStatus = 500) {
  if (error instanceof AppError) {
    return createError({
      statusCode: error.status,
      statusMessage: error.message,
    })
  }

  if (error instanceof ZodError) {
    return createError({
      statusCode: 400,
      statusMessage: error.issues.map((issue) => issue.message).join('; '),
    })
  }

  if (error instanceof Error) {
    return createError({
      statusCode: fallbackStatus,
      statusMessage: error.message,
    })
  }

  return createError({
    statusCode: fallbackStatus,
    statusMessage: 'Unexpected error',
  })
}

/**
 * Create a 400 Bad Request error.
 */
export function badRequest(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: message,
  })
}

/**
 * Create a 401 Unauthorized error.
 */
export function unauthorized(message = 'Unauthorized') {
  return createError({
    statusCode: 401,
    statusMessage: message,
  })
}

/**
 * Create a 403 Forbidden error.
 */
export function forbidden(message = 'Forbidden') {
  return createError({
    statusCode: 403,
    statusMessage: message,
  })
}

/**
 * Create a 404 Not Found error.
 */
export function notFound(message = 'Not found') {
  return createError({
    statusCode: 404,
    statusMessage: message,
  })
}

/**
 * Create a 500 Internal Server Error.
 */
export function internalError(message = 'Internal server error') {
  return createError({
    statusCode: 500,
    statusMessage: message,
  })
}
