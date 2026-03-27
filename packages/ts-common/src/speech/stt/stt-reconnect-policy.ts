export type SttReconnectPolicy = {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}

export type SttDisconnectReason = 'close' | 'error' | 'bootstrap'

export const DEFAULT_STT_RECONNECT_POLICY: SttReconnectPolicy = {
  maxAttempts: 6,
  baseDelayMs: 500,
  maxDelayMs: 15000,
  jitterRatio: 0.2,
}

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null
  }

  const candidate = error as { code?: unknown }
  return typeof candidate.code === 'string' ? candidate.code : null
}

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return ''
}

export const computeSttReconnectDelayMs = ({
  attempt,
  policy,
  random = Math.random,
}: {
  attempt: number
  policy: SttReconnectPolicy
  random?: () => number
}) => {
  const normalizedAttempt = Math.max(1, Math.floor(attempt))
  const exponentialDelay = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** (normalizedAttempt - 1),
  )
  const boundedRandom = Math.min(Math.max(random(), 0), 1)
  const jitterMs = Math.round(
    exponentialDelay * policy.jitterRatio * boundedRandom,
  )
  return exponentialDelay + jitterMs
}

export const shouldRetrySttDisconnect = ({
  attempt,
  policy,
  error,
}: {
  attempt: number
  policy: SttReconnectPolicy
  error?: unknown
}) => {
  if (attempt > policy.maxAttempts) {
    return false
  }

  const code = readErrorCode(error)
  if (code === 'STT_CONFIG_MISSING') {
    return false
  }

  const message = readErrorMessage(error).toLowerCase()
  if (
    message.includes('balance exhausted') ||
    message.includes('quota exceeded') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return false
  }

  return true
}
