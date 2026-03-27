import { useCallback } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { toAppError } from '@/lib/errors'
import { logAppError } from '@/lib/logging'

type AnalyzeCorrections = (args: {
  sessionId: Id<'speakingSessions'>
  text: string
  transcriptEventId?: Id<'speakingEvents'>
}) => Promise<{ inserted: number }>

type CorrectionsPipelineParams = {
  analyzeCorrections: AnalyzeCorrections
  logEventMutation: (args: unknown) => Promise<unknown>
  isStopRequested: () => boolean
  targetLanguage: string
  sourceLanguage?: string
}

type CorrectionsRequest = {
  sessionId: Id<'speakingSessions'>
  text: string
  transcriptEventId?: Id<'speakingEvents'>
}

export const useCorrectionsPipeline = ({
  analyzeCorrections,
  logEventMutation,
  isStopRequested,
  targetLanguage,
  sourceLanguage,
}: CorrectionsPipelineParams) => {
  const requestCorrections = useCallback(
    ({ sessionId, text, transcriptEventId }: CorrectionsRequest) => {
      if (isStopRequested()) {
        return
      }

      void analyzeCorrections({
        sessionId,
        text,
        transcriptEventId,
      }).catch((err) => {
        console.error('Corrections failed', err)
        const appError = toAppError(err, {
          message: 'Corrections are unavailable right now.',
          source: 'convex',
          code: 'CORRECTIONS_FAILED',
        })
        void logAppError(logEventMutation, appError, {
          feature: 'speaking-session',
          action: 'corrections',
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
      analyzeCorrections,
      isStopRequested,
      logEventMutation,
      sourceLanguage,
      targetLanguage,
    ],
  )

  return { requestCorrections }
}
