import type { Id } from '../../convex/_generated/dataModel'

type LearnerInsightRequest = {
  sessionId: Id<'speakingSessions'>
  text: string
  transcriptEventId: Id<'speakingEvents'>
}

type EmitLatencyTelemetry = (
  stage: string,
  details?: Record<string, unknown>,
) => void

type LearnerInsightDispatchParams = {
  request: LearnerInsightRequest
  requestCorrections: (request: LearnerInsightRequest) => void
  requestVocabulary: (request: LearnerInsightRequest) => void
  emitLatencyTelemetry: EmitLatencyTelemetry
  serializeError: (error: unknown) => unknown
}

const dispatchAnalyzer = ({
  analyzer,
  dispatch,
  request,
  emitLatencyTelemetry,
  serializeError,
}: {
  analyzer: 'corrections' | 'vocabulary'
  dispatch: (request: LearnerInsightRequest) => void
  request: LearnerInsightRequest
  emitLatencyTelemetry: EmitLatencyTelemetry
  serializeError: (error: unknown) => unknown
}) => {
  try {
    dispatch(request)
    emitLatencyTelemetry('transcript_flush_done', {
      role: 'learner',
      textChars: request.text.length,
      transcriptEventId: String(request.transcriptEventId),
      analyzer,
    })
  } catch (err) {
    console.error('Learner insight dispatch failed', err)
    emitLatencyTelemetry('transcript_flush_failed', {
      role: 'learner',
      analyzer,
      error: serializeError(err),
    })
  }
}

export const dispatchLearnerInsights = ({
  request,
  requestCorrections,
  requestVocabulary,
  emitLatencyTelemetry,
  serializeError,
}: LearnerInsightDispatchParams) => {
  dispatchAnalyzer({
    analyzer: 'corrections',
    dispatch: requestCorrections,
    request,
    emitLatencyTelemetry,
    serializeError,
  })
  dispatchAnalyzer({
    analyzer: 'vocabulary',
    dispatch: requestVocabulary,
    request,
    emitLatencyTelemetry,
    serializeError,
  })
}
