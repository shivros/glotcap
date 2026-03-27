import { toAppError } from '../logging/errors'
import type { AppError } from '../logging/errors'

export const DEFAULT_CONVEX_ERROR_FALLBACK_MESSAGE =
  'Something went wrong. Please try again.'

export const DEFAULT_CONVEX_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_IN_USE:
    'That email is already associated with another account.',
}

type ConvexErrorLike = {
  message?: unknown
  code?: unknown
  data?: {
    code?: unknown
    message?: unknown
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function extractConvexErrorPayload(error: unknown): {
  code?: string
  message?: string
} {
  if (!isRecord(error)) {
    return {}
  }

  const maybe = error as ConvexErrorLike
  const code =
    typeof maybe.data?.code === 'string'
      ? maybe.data.code
      : typeof maybe.code === 'string'
        ? maybe.code
        : undefined
  const message =
    typeof maybe.data?.message === 'string'
      ? maybe.data.message
      : typeof maybe.message === 'string'
        ? maybe.message
        : undefined

  return { code, message }
}

export function containsUnsafeRuntimeMetadata(message: string) {
  const normalized = message.trim()
  if (!normalized) return true

  return (
    normalized.startsWith('[CONVEX ') ||
    normalized.includes('Request ID:') ||
    normalized.includes('Server Error') ||
    normalized.includes('Called by client') ||
    /\sat\s.+\.(ts|tsx|js|jsx):\d/.test(normalized)
  )
}

export function createConvexErrorCatalog(
  additionalMessages: Record<string, string> = {},
): Record<string, string> {
  return {
    ...DEFAULT_CONVEX_ERROR_MESSAGES,
    ...additionalMessages,
  }
}

export type NormalizedConvexUiError = Pick<
  AppError,
  'code' | 'message' | 'retryable'
> & {
  known: boolean
}

export type NormalizeConvexUiErrorOptions = {
  fallbackMessage?: string
  catalog?: Record<string, string>
}

export function normalizeConvexUiError(
  error: unknown,
  options: NormalizeConvexUiErrorOptions = {},
): NormalizedConvexUiError {
  const fallbackMessage =
    options.fallbackMessage ?? DEFAULT_CONVEX_ERROR_FALLBACK_MESSAGE
  const catalog = options.catalog ?? DEFAULT_CONVEX_ERROR_MESSAGES

  const appError = toAppError(error, {
    source: 'convex',
    message: fallbackMessage,
  })
  const payload = extractConvexErrorPayload(error)
  const code = payload.code ?? appError.code
  const knownMessage = catalog[code]

  if (knownMessage) {
    return {
      code,
      message: knownMessage,
      retryable: appError.retryable,
      known: true,
    }
  }

  const candidateMessage =
    typeof payload.message === 'string' && payload.message.trim().length > 0
      ? payload.message.trim()
      : appError.message
  const safeMessage =
    typeof error === 'string' || containsUnsafeRuntimeMetadata(candidateMessage)
      ? fallbackMessage
      : candidateMessage

  return {
    code,
    message: safeMessage,
    retryable: appError.retryable,
    known: false,
  }
}
