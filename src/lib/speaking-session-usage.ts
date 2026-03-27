import { useCallback, useRef } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import type { UsageRetryPolicy } from '@/lib/usage/usage-retry-policy'
import { createDefaultUsageRetryPolicy } from '@/lib/usage/usage-retry-policy'

const MAX_USAGE_CHUNK_MS = 15000

type UsageResult = {
  usageMs: number
  limitMs: number
  status: string
}

type UsageTrackerParams = {
  ingestAudioChunk: (args: {
    sessionId: Id<'speakingSessions'>
    chunkMs: number
  }) => Promise<UsageResult>
  getActiveSessionId: () => Id<'speakingSessions'> | null
  isStopRequested: () => boolean
  onUsageUpdate: (usageMs: number, limitMs: number) => void
  onLimitReached: () => Promise<void>
  onError: (err: unknown) => void
  retryPolicy?: UsageRetryPolicy
}

type UsageTracker = {
  queueUsage: (sessionId: Id<'speakingSessions'>, chunkMs: number) => void
  reset: () => void
}

const clampDeltaMs = (value: number) =>
  Math.max(0, Math.min(value, MAX_USAGE_CHUNK_MS))

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export const useUsageTracker = ({
  ingestAudioChunk,
  getActiveSessionId,
  isStopRequested,
  onUsageUpdate,
  onLimitReached,
  onError,
  retryPolicy = createDefaultUsageRetryPolicy(),
}: UsageTrackerParams): UsageTracker => {
  const pendingUsageRef = useRef(0)
  const usageFlushInFlightRef = useRef(false)

  const reset = useCallback(() => {
    pendingUsageRef.current = 0
    usageFlushInFlightRef.current = false
  }, [])

  const flushUsage = useCallback(
    async (sessionId: Id<'speakingSessions'>) => {
      if (usageFlushInFlightRef.current) {
        return
      }
      usageFlushInFlightRef.current = true

      try {
        while (pendingUsageRef.current > 0) {
          if (isStopRequested() || getActiveSessionId() !== sessionId) {
            pendingUsageRef.current = 0
            return
          }

          const deltaMs = clampDeltaMs(pendingUsageRef.current)
          pendingUsageRef.current = Math.max(
            pendingUsageRef.current - deltaMs,
            0,
          )

          let attempt = 0
          let result: UsageResult | null = null

          while (!result) {
            try {
              result = await ingestAudioChunk({
                sessionId,
                chunkMs: deltaMs,
              })
            } catch (err) {
              attempt += 1
              const retryable = retryPolicy.shouldRetry({
                attempt,
                error: err,
              })
              if (!retryable) {
                throw err
              }
              await sleep(retryPolicy.getDelayMs(attempt))
              if (isStopRequested() || getActiveSessionId() !== sessionId) {
                pendingUsageRef.current = 0
                return
              }
            }
          }

          onUsageUpdate(result.usageMs, result.limitMs)

          if (result.status === 'limit_reached') {
            await onLimitReached()
            return
          }
        }
      } catch (err) {
        pendingUsageRef.current = 0
        onError(err)
      } finally {
        usageFlushInFlightRef.current = false
      }
    },
    [
      getActiveSessionId,
      ingestAudioChunk,
      isStopRequested,
      onLimitReached,
      onUsageUpdate,
      onError,
      retryPolicy,
    ],
  )

  const queueUsage = useCallback(
    (sessionId: Id<'speakingSessions'>, chunkMs: number) => {
      const safeChunk = Math.max(0, chunkMs)
      if (!safeChunk) {
        return
      }
      pendingUsageRef.current += safeChunk
      void flushUsage(sessionId)
    },
    [flushUsage],
  )

  return { queueUsage, reset }
}
