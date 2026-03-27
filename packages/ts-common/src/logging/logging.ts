import type { AppError } from './errors'

export type LogContext = {
  feature?: string
  action?: string
  entityId?: string
  entityType?: string
  details?: Record<string, unknown>
}

const recentLogCache = new Map<string, number>()
const LOG_TTL_MS = 30_000
const MAX_STACK_LENGTH = 2000

const shouldLog = (key: string) => {
  const now = Date.now()
  const last = recentLogCache.get(key)
  if (last && now - last < LOG_TTL_MS) {
    return false
  }
  recentLogCache.set(key, now)
  return true
}

const redact = (value: unknown) => {
  if (typeof value !== 'string') {
    return value
  }

  return value
    .replace(/(api[_-]?key|token|secret)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]')
}

const scrubContext = (context?: LogContext) => {
  if (!context) {
    return undefined
  }

  const safeDetails: Record<string, unknown> = {}
  if (context.details) {
    Object.entries(context.details).forEach(([key, value]) => {
      safeDetails[key] = redact(value)
    })
  }

  return {
    feature: context.feature,
    action: context.action,
    entityId: context.entityId,
    entityType: context.entityType,
    details: safeDetails,
  }
}

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    const extra = error as Error & {
      code?: string
      details?: Record<string, unknown>
    }
    return {
      name: error.name,
      message: redact(error.message),
      stack: error.stack
        ? (() => {
            const redacted = redact(error.stack)
            return typeof redacted === 'string'
              ? redacted.slice(0, MAX_STACK_LENGTH)
              : undefined
          })()
        : undefined,
      code: extra.code,
      details: extra.details
        ? Object.entries(extra.details).reduce<Record<string, unknown>>(
            (acc, [key, value]) => {
              acc[key] = redact(value)
              return acc
            },
            {},
          )
        : undefined,
    }
  }

  if (typeof error === 'string') {
    return { message: redact(error) }
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { message?: string; code?: string }
    return {
      message: redact(maybeError.message ?? 'Unknown error'),
      code: maybeError.code,
    }
  }

  return { message: 'Unknown error' }
}

export const logAppError = async (
  logMutation: (args: {
    level?: string
    code?: string
    message: string
    source?: string
    context?: Record<string, unknown>
    entityId?: string
    entityType?: string
  }) => Promise<unknown>,
  error: AppError,
  context?: LogContext,
) => {
  const key = `${error.code}-${context?.feature ?? 'unknown'}-${
    context?.action ?? 'unknown'
  }`
  if (!shouldLog(key)) {
    return
  }

  const payload = {
    level: 'error',
    code: error.code,
    message: error.message,
    source: error.source,
    context: scrubContext(context),
    entityId: context?.entityId,
    entityType: context?.entityType,
  }

  if (typeof window !== 'undefined') {
    console.error('App error', payload)
  }

  try {
    await logMutation(payload)
  } catch (err) {
    if (typeof window !== 'undefined') {
      console.error('Failed to log error', err)
    }
  }
}

export const logEvent = async (
  logMutation: (args: {
    level?: string
    code?: string
    message: string
    source?: string
    context?: Record<string, unknown>
    entityId?: string
    entityType?: string
  }) => Promise<unknown>,
  message: string,
  context?: LogContext,
) => {
  const key = `${message}-${context?.feature ?? 'unknown'}-${
    context?.action ?? 'unknown'
  }`
  if (!shouldLog(key)) {
    return
  }

  const payload = {
    level: 'info',
    message,
    source: context?.feature,
    context: scrubContext(context),
    entityId: context?.entityId,
    entityType: context?.entityType,
  }

  try {
    await logMutation(payload)
  } catch (err) {
    if (typeof window !== 'undefined') {
      console.error('Failed to log event', err)
    }
  }
}
