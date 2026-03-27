export type UsageRetryContext = {
  attempt: number
  error: unknown
}

export interface UsageRetryPolicy {
  shouldRetry: (context: UsageRetryContext) => boolean
  getDelayMs: (attempt: number) => number
}

const DEFAULT_MAX_RETRY_ATTEMPTS = 3
const DEFAULT_BASE_RETRY_DELAY_MS = 200
const DEFAULT_MAX_RETRY_DELAY_MS = 1500

const readMessage = (err: unknown) =>
  err instanceof Error
    ? err.message.toLowerCase()
    : typeof err === 'string'
      ? err.toLowerCase()
      : ''

const isTransientUsageError = (err: unknown) => {
  const message = readMessage(err)
  return (
    message.includes('connection lost while action was in flight') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  )
}

export const createDefaultUsageRetryPolicy = (): UsageRetryPolicy => ({
  shouldRetry: ({ attempt, error }) =>
    attempt < DEFAULT_MAX_RETRY_ATTEMPTS && isTransientUsageError(error),
  getDelayMs: (attempt) =>
    Math.min(
      DEFAULT_MAX_RETRY_DELAY_MS,
      DEFAULT_BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    ),
})
