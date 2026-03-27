import { useCallback } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { toAppError } from '@/lib/errors'
import { logAppError } from '@/lib/logging'

type AnalyzeVocabulary = (args: {
  sessionId: Id<'speakingSessions'>
  text: string
  transcriptEventId?: Id<'speakingEvents'>
}) => Promise<{ inserted: number }>

type VocabularyPipelineParams = {
  analyzeVocabulary: AnalyzeVocabulary
  logEventMutation: (args: unknown) => Promise<unknown>
  isStopRequested: () => boolean
  targetLanguage: string
  sourceLanguage?: string
}

type VocabularyRequest = {
  sessionId: Id<'speakingSessions'>
  text: string
  transcriptEventId?: Id<'speakingEvents'>
}

export const useVocabularyPipeline = ({
  analyzeVocabulary,
  logEventMutation,
  isStopRequested,
  targetLanguage,
  sourceLanguage,
}: VocabularyPipelineParams) => {
  const requestVocabulary = useCallback(
    ({ sessionId, text, transcriptEventId }: VocabularyRequest) => {
      if (isStopRequested()) {
        return
      }

      void analyzeVocabulary({
        sessionId,
        text,
        transcriptEventId,
      }).catch((err) => {
        console.error('Vocabulary failed', err)
        const appError = toAppError(err, {
          message: 'Vocabulary suggestions are unavailable right now.',
          source: 'convex',
          code: 'VOCABULARY_FAILED',
        })
        void logAppError(logEventMutation, appError, {
          feature: 'speaking-session',
          action: 'vocabulary',
          entityId: sessionId,
          entityType: 'speaking-session',
          details: {
            text,
            targetLanguage,
            sourceLanguage,
            transcriptEventId,
          },
        })
      })
    },
    [
      analyzeVocabulary,
      isStopRequested,
      logEventMutation,
      sourceLanguage,
      targetLanguage,
    ],
  )

  return { requestVocabulary }
}
