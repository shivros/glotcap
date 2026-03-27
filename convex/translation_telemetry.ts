import type {
  TranslationAttempt,
  TranslationReason,
  TranslationRequest,
} from './translation_service'

type LogEventPayload = {
  level?: string
  code?: string
  message: string
  source?: string
  context?: Record<string, unknown>
  entityId?: string
  entityType?: string
  sessionId?: string
}

type LogEventWriter = (payload: LogEventPayload) => Promise<unknown>

export type TranslationTelemetryContext = {
  sessionId?: string
  sourceId?: string
  reason?: TranslationReason
  revision?: number
}

export interface ITranslationTelemetrySink {
  recordProviderTiming: (args: {
    request: TranslationRequest
    attempt: TranslationAttempt
    context: TranslationTelemetryContext
  }) => void
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown translation error'
}

export class ConvexTranslationTelemetrySink implements ITranslationTelemetrySink {
  private readonly writeEvent: LogEventWriter

  constructor(writeEvent: LogEventWriter) {
    this.writeEvent = writeEvent
  }

  recordProviderTiming({
    request,
    attempt,
    context,
  }: {
    request: TranslationRequest
    attempt: TranslationAttempt
    context: TranslationTelemetryContext
  }) {
    void this.writeEvent({
      level: attempt.status === 'error' ? 'error' : 'info',
      message: 'translation.provider.timing',
      source: 'convex-translations',
      sessionId: context.sessionId,
      entityId: context.sessionId,
      entityType: context.sessionId ? 'speaking-session' : 'translation',
      context: {
        feature: 'translation-latency',
        action: 'provider_timing',
        details: {
          model: attempt.model,
          sourceId: context.sourceId,
          reason: context.reason,
          revision: context.revision,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          requestTextChars: request.text.length,
          translatedChars: attempt.text.length,
          chunkCount: attempt.timings.chunkCount,
          ttftMs: attempt.timings.ttftMs,
          totalMs: attempt.timings.totalMs,
          status: attempt.status,
          errorMessage:
            attempt.status === 'error'
              ? getErrorMessage(attempt.error)
              : undefined,
        },
      },
    }).catch((loggingError) => {
      console.error(
        'Failed to persist translation timing telemetry',
        loggingError,
      )
    })
  }
}
