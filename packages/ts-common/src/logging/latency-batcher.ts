import { createBufferedBatcher } from '../streaming/buffered-batcher'

export type LatencyLogEventMutation = (args: {
  level?: string
  code?: string
  message: string
  source?: string
  context?: Record<string, unknown>
  entityId?: string
  entityType?: string
  sessionId?: string
}) => Promise<unknown>

export type LatencyTelemetryEvent = {
  stage: string
  at: number
  details?: Record<string, unknown>
}

export type LatencyTelemetryBatcherOptions = {
  enabled: boolean
  source: string
  feature: string
  logEventMutation: LatencyLogEventMutation
  getSessionId?: () => string | undefined
  batchMs?: number
  maxBatchSize?: number
  now?: () => number
  onError?: (error: unknown) => void
}

const DEFAULT_BATCH_MS = 1000
const DEFAULT_MAX_BATCH_SIZE = 32

export const createLatencyTelemetryBatcher = ({
  enabled,
  source,
  feature,
  logEventMutation,
  getSessionId,
  batchMs = DEFAULT_BATCH_MS,
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  now = () => Date.now(),
  onError,
}: LatencyTelemetryBatcherOptions) => {
  const writeBatch = async (events: Array<LatencyTelemetryEvent>) => {
    if (!enabled || events.length === 0) {
      return
    }
    const sessionId = getSessionId?.()
    await logEventMutation({
      level: 'info',
      message: 'latency.telemetry.batch',
      source,
      sessionId,
      entityId: sessionId,
      entityType: 'speaking-session',
      context: {
        feature,
        action: 'batch',
        details: {
          eventCount: events.length,
          events,
        },
      },
    })
  }

  const batcher = createBufferedBatcher<LatencyTelemetryEvent>({
    flush: writeBatch,
    batchMs,
    maxBatchSize,
    onError: (error) => {
      onError?.(error)
      if (!onError) {
        console.error('Failed to write latency telemetry', error)
      }
    },
  })

  const emit = (stage: string, details?: Record<string, unknown>) => {
    if (!enabled) {
      return
    }
    batcher.enqueue({
      stage,
      at: now(),
      details,
    })
  }

  const dispose = () => {
    void batcher.dispose()
  }

  return {
    emit,
    flush: () => {
      void batcher.flush()
    },
    dispose,
    size: () => batcher.size(),
  }
}
