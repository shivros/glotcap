import { useAction, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPcmRecorder } from 'ts-common/speech/audio'
import { createLatencyTelemetryBatcher } from 'ts-common/logging/latency-batcher'
import { api } from '../../convex/_generated/api'
import type { PcmRecorder } from 'ts-common/speech/audio'
import type {
  RuntimeSttConfig,
  SttCloseInfo,
  SttLifecycleEvent,
} from 'ts-common/speech/stt'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type {
  MicPermission,
  SpeakingSessionMode,
  SpeakingSessionOptions,
  SpeakingSessionStatus,
} from '@/lib/speaking-session-types'
import type { SttContext, SttRecoveryState } from '@/lib/speaking-session-stt'
import type { SpeakingSessionSingleStreamTurnController } from '@/lib/speaking-session-single-stream-turn'
import { toAppError } from '@/lib/errors'
import { logAppError, serializeError } from '@/lib/logging'
import { resolveConvexSiteUrl } from '@/lib/convex-site'
import { useAudioSupport } from '@/lib/speaking-session-audio-support'
import { useCoachPlayback } from '@/lib/speaking-session-coach-playback'
import {
  getCoachInterruptionHoldMs,
  getCoachResponseGapMs,
} from '@/lib/speaking-session-config'
import { acquireTeacherAudioStream } from '@/lib/audio/teacher-audio-source'
import { useCorrectionsPipeline } from '@/lib/speaking-session-corrections'
import { dispatchLearnerInsights } from '@/lib/speaking-session-learner-insights'
import { useSessionLifecycle } from '@/lib/speaking-session-lifecycle'
import { createSpeakingSessionSingleStreamTurnController } from '@/lib/speaking-session-single-stream-turn'
import { createSpeakingSessionObserver } from '@/lib/speaking-session-observer'
import { sanitizeSpeechText } from '@/lib/speaking-session-text'
import { useTurnCoordinator } from '@/lib/speaking-session-turn-coordinator'
import { useUsageTracker } from '@/lib/speaking-session-usage'
import { useVocabularyPipeline } from '@/lib/speaking-session-vocabulary'
import { useSttPipeline } from '@/lib/speaking-session-stt'

const DEFAULT_SAMPLE_RATE = 16000

const resolveSttDiagnostics = (config: RuntimeSttConfig | null) => {
  if (!config) {
    return {
      sampleRate: undefined,
      audioFormat: undefined,
      languageHints: undefined,
    }
  }

  if (config.provider === 'soniox') {
    return {
      sampleRate: config.config.sample_rate,
      audioFormat: config.config.audio_format,
      languageHints: config.config.language_hints,
    }
  }

  return {
    sampleRate: config.config.sample_rate,
    audioFormat: config.config.encoding,
    languageHints: config.config.language
      ? [config.config.language]
      : undefined,
  }
}

type SpeakingSessionState = {
  status: SpeakingSessionStatus
  mode: SpeakingSessionMode | null
  sessionId: Id<'speakingSessions'> | null
  activeCoachStreamId: string | null
  usageMs: number
  limitMs: number
  remainingMs: number | null
  error: string | null
  transcriptionNotice: string | null
  micPermission: MicPermission
  isSupported: boolean
  isActive: boolean
  canResume: boolean
  start: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  enqueueCoachSegment: (
    streamId: string,
    segment: string,
    isFinal: boolean,
  ) => void
  completeCoachStream: (streamId: string) => void
  reset: () => void
}

type SpeakingEvent = Doc<'speakingEvents'>

export const useSpeakingSession = (
  options: SpeakingSessionOptions,
): SpeakingSessionState => {
  const isDualStreamMode = options.conversationMode === 'dual_stream'
  const teacherInputSourceMethod = options.teacherInputSourceMethod ?? 'device'
  const startSession = useMutation(api.speaking.startSession)
  const endSession = useMutation(api.speaking.endSession)
  const pauseSession = useMutation(api.speaking.pauseSession)
  const resumeSession = useMutation(api.speaking.resumeSession)
  const ingestAudioChunk = useAction(api.speaking.ingestAudioChunk)
  const upsertUserTranscript = useMutation(api.speaking.upsertUserTranscript)
  const setActiveTurnId = useMutation(api.speaking.setActiveTurnId)
  const cancelCoachReplyStream = useMutation(
    api.speaking.cancelCoachReplyStream,
  )
  const analyzeCorrections = useAction(api.corrections.analyzeTurn)
  const analyzeVocabulary = useAction(api.vocabulary.analyzeTurn)
  const createSttSession = useAction(api.stt.createSession)
  const synthesizeSpeech = useAction(api.tts.synthesize)
  const startCoachReplyStream = useMutation(api.speaking.startCoachReplyStream)
  const logEventMutation = useMutation(api.logging.logEvent)
  const telemetryEnabled =
    (import.meta.env.VITE_LATENCY_TELEMETRY as string | undefined) !== 'false'

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  const convexSiteUrl = useMemo(() => {
    if (!convexUrl) {
      return null
    }
    return resolveConvexSiteUrl(
      convexUrl,
      import.meta.env.VITE_CONVEX_SITE_URL as string | undefined,
    )
  }, [convexUrl])
  const ttsStreamUrl = useMemo(() => {
    if (!convexSiteUrl) {
      return null
    }
    return new URL('/tts-stream', convexSiteUrl)
  }, [convexSiteUrl])

  const [status, setStatus] = useState<SpeakingSessionStatus>('idle')
  const [mode, setMode] = useState<SpeakingSessionMode | null>(null)
  const [sessionId, setSessionId] = useState<Id<'speakingSessions'> | null>(
    null,
  )
  const [activeCoachStreamId, setActiveCoachStreamId] = useState<string | null>(
    null,
  )
  const [usageMs, setUsageMs] = useState(0)
  const [limitMs, setLimitMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(
    null,
  )
  const [resumeAvailable, setResumeAvailable] = useState(false)
  const statusRef = useRef<SpeakingSessionStatus>('idle')
  statusRef.current = status
  const modeRef = useRef<SpeakingSessionMode | null>(null)
  modeRef.current = mode
  const conversationModeRef = useRef<string>(
    options.conversationMode ?? 'coach',
  )
  conversationModeRef.current = options.conversationMode ?? 'coach'
  const {
    micPermission,
    isSupported,
    detectAudioSupport,
    setMicPermission,
    setSupportStatus,
  } = useAudioSupport()
  const {
    getTurnId,
    markActive: markTurnActive,
    markFinalized: markTurnFinalized,
    invalidateTurn,
    advanceTurn,
    reset: resetTurn,
    isFinalized: isTurnFinalized,
  } = useTurnCoordinator()

  const streamRef = useRef<MediaStream | null>(null)
  const teacherStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<PcmRecorder | null>(null)
  const teacherRecorderRef = useRef<PcmRecorder | null>(null)
  const sttContextRef = useRef<SttContext>({ config: null, close: null })
  const teacherSttContextRef = useRef<SttContext>({
    config: null,
    close: null,
  })
  const activeCoachStreamRef = useRef<string | null>(null)
  const activeCoachEventRef = useRef<Id<'speakingEvents'> | null>(null)
  const sessionIdRef = useRef<Id<'speakingSessions'> | null>(null)
  const stopInProgressRef = useRef<boolean>(false)
  const userTranscriptRef = useRef<{
    eventId: Id<'speakingEvents'> | null
    text: string
  }>({ eventId: null, text: '' })
  const teacherTranscriptRef = useRef<{
    eventId: Id<'speakingEvents'> | null
    text: string
  }>({ eventId: null, text: '' })
  const userTranscriptQueueRef = useRef<Promise<void>>(Promise.resolve())
  const teacherTranscriptQueueRef = useRef<Promise<void>>(Promise.resolve())
  const stopRef = useRef<
    (reason?: 'manual' | 'limit' | 'error') => Promise<void>
  >(async () => {})
  const dualLearnerFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const dualTeacherFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const isStopRequested = useCallback(() => stopInProgressRef.current, [])
  const coachErrorRef = useRef<(err: unknown) => void>(() => {})
  const coachReplyInFlightRef = useRef<string | null>(null)
  const coachReplyQueueRef = useRef<Promise<void>>(Promise.resolve())
  const turnSyncRef = useRef<Promise<void>>(Promise.resolve())
  const singleStreamTurnControllerRef =
    useRef<SpeakingSessionSingleStreamTurnController | null>(null)
  const lastCoachAudioActivityAtRef = useRef<number | null>(null)
  const usageResetRef = useRef<() => void>(() => {})
  const stopSttRef = useRef<() => void>(() => {})
  const stopTeacherSttRef = useRef<() => void>(() => {})
  const telemetryBatcherRef = useRef<ReturnType<
    typeof createLatencyTelemetryBatcher
  > | null>(null)
  const speechProbeRef = useRef({
    learner: {
      startedAt: null as number | null,
      activityCount: 0,
    },
    teacher: {
      startedAt: null as number | null,
      activityCount: 0,
    },
  })
  const learnerSttRecoveryRef = useRef<SttRecoveryState>('stable')
  const teacherSttRecoveryRef = useRef<SttRecoveryState>('stable')
  const observer = useMemo(
    () =>
      createSpeakingSessionObserver({
        getContext: () => ({
          conversationMode: conversationModeRef.current,
          status: statusRef.current,
          mode: modeRef.current ?? undefined,
          sessionId: sessionIdRef.current ?? undefined,
          activeCoachStreamId: activeCoachStreamRef.current ?? undefined,
          stopRequested: stopInProgressRef.current,
        }),
      }),
    [],
  )

  const getActiveSessionId = useCallback(() => sessionIdRef.current, [])
  useEffect(() => {
    const batcher = createLatencyTelemetryBatcher({
      enabled: telemetryEnabled,
      source: 'speaking-session',
      feature: 'speaking-latency',
      logEventMutation,
      getSessionId: () =>
        sessionIdRef.current ? String(sessionIdRef.current) : undefined,
    })
    telemetryBatcherRef.current = batcher
    return () => {
      batcher.dispose()
      if (telemetryBatcherRef.current === batcher) {
        telemetryBatcherRef.current = null
      }
    }
  }, [logEventMutation, telemetryEnabled])

  const emitLatencyTelemetry = useCallback(
    (stage: string, details?: Record<string, unknown>) => {
      telemetryBatcherRef.current?.emit(stage, {
        ...details,
        mode: options.conversationMode ?? 'coach',
        status,
      })
    },
    [options.conversationMode, status],
  )

  const markSpeechActivity = useCallback(
    (role: 'learner' | 'teacher', text: string) => {
      const cleaned = sanitizeSpeechText(text)
      if (!cleaned) {
        return
      }
      const probe = speechProbeRef.current[role]
      if (!probe.startedAt) {
        probe.startedAt = Date.now()
        probe.activityCount = 0
        emitLatencyTelemetry('stt_utterance_started', {
          role,
        })
      }
      probe.activityCount += 1
    },
    [emitLatencyTelemetry],
  )

  const consumeSpeechProbe = useCallback((role: 'learner' | 'teacher') => {
    const probe = speechProbeRef.current[role]
    const snapshot = {
      startedAt: probe.startedAt,
      activityCount: probe.activityCount,
    }
    probe.startedAt = null
    probe.activityCount = 0
    return snapshot
  }, [])

  const resetUserTranscript = useCallback(() => {
    userTranscriptRef.current = { eventId: null, text: '' }
    userTranscriptQueueRef.current = Promise.resolve()
  }, [])
  const resetTeacherTranscript = useCallback(() => {
    teacherTranscriptRef.current = { eventId: null, text: '' }
    teacherTranscriptQueueRef.current = Promise.resolve()
  }, [])

  const clearResumeState = useCallback(() => {
    setResumeAvailable(false)
  }, [])

  const updateTranscriptionNotice = useCallback(() => {
    const learner = learnerSttRecoveryRef.current
    const teacher = isDualStreamMode ? teacherSttRecoveryRef.current : 'stable'
    const isLearnerReconnecting = learner === 'reconnecting'
    const isTeacherReconnecting = teacher === 'reconnecting'

    if (isLearnerReconnecting && isTeacherReconnecting) {
      setTranscriptionNotice('Reconnecting learner and teacher transcription…')
      return
    }
    if (isLearnerReconnecting) {
      setTranscriptionNotice('Reconnecting learner transcription…')
      return
    }
    if (isTeacherReconnecting) {
      setTranscriptionNotice('Reconnecting teacher transcription…')
      return
    }
    setTranscriptionNotice(null)
  }, [isDualStreamMode])

  const syncActiveTurnId = useCallback(
    (turnId: string) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || stopInProgressRef.current) {
        return
      }
      turnSyncRef.current = setActiveTurnId({
        sessionId: activeSessionId,
        turnId,
      })
        .then(() => undefined)
        .catch((err) => {
          console.error('Failed to update turn id', err)
        })
    },
    [setActiveTurnId],
  )

  const { requestCorrections } = useCorrectionsPipeline({
    analyzeCorrections,
    logEventMutation,
    isStopRequested,
    targetLanguage: options.targetLanguage,
    sourceLanguage: options.sourceLanguage,
  })
  const { requestVocabulary } = useVocabularyPipeline({
    analyzeVocabulary,
    logEventMutation,
    isStopRequested,
    targetLanguage: options.targetLanguage,
    sourceLanguage: options.sourceLanguage,
  })

  const {
    initPlayback,
    haltPlayback,
    interruptPlayback,
    resetPlayback,
    isPlaying,
    speakCoachText,
  } = useCoachPlayback({
    ttsStreamUrl,
    ttsConfig: {
      voiceId: options.ttsVoiceId,
      modelId: options.ttsModelId,
      languageCode: options.ttsLanguageCode,
      outputFormat: options.ttsOutputFormat,
      latencyHint: options.ttsLatencyHint,
    },
    synthesizeSpeech,
    isStopRequested,
    onError: (err) => coachErrorRef.current(err),
  })

  const remainingMs = useMemo(() => {
    if (!limitMs) {
      return null
    }

    return Math.max(limitMs - usageMs, 0)
  }, [limitMs, usageMs])

  const getNetworkContext = () => {
    if (typeof navigator === 'undefined') {
      return undefined
    }

    const connection =
      'connection' in navigator
        ? (
            navigator as Navigator & {
              connection?: {
                effectiveType?: string
                rtt?: number
                downlink?: number
                saveData?: boolean
              }
            }
          ).connection
        : undefined

    return {
      online: navigator.onLine,
      connection: connection
        ? {
            effectiveType: connection.effectiveType,
            rtt: connection.rtt,
            downlink: connection.downlink,
            saveData: connection.saveData,
          }
        : undefined,
    }
  }

  const failSession = useCallback(
    async (
      err: unknown,
      fallback: string,
      source: 'stt' | 'tts' | 'media' | 'network' | 'convex',
      details?: Record<string, unknown>,
    ) => {
      const appError = toAppError(err, {
        message: fallback,
        source,
      })
      const sttContext = sttContextRef.current
      const teacherSttContext = teacherSttContextRef.current
      const sttDiagnostics = resolveSttDiagnostics(sttContext.config)
      const teacherSttDiagnostics = resolveSttDiagnostics(
        teacherSttContext.config,
      )
      setError(appError.message)
      await logAppError(logEventMutation, appError, {
        feature: 'speaking-session',
        action: 'fail',
        entityId: sessionIdRef.current ?? undefined,
        entityType: 'speaking-session',
        details: {
          error: serializeError(err),
          mode: options.mode ?? 'demo',
          targetLanguage: options.targetLanguage,
          sourceLanguage: options.sourceLanguage,
          sttProvider: sttContext.config?.provider,
          sttUrl: sttContext.config?.url,
          sttModel: sttContext.config?.config.model,
          sttLanguage: options.sttLanguage,
          sttSampleRate: sttDiagnostics.sampleRate,
          sttAudioFormat: sttDiagnostics.audioFormat,
          sttLanguageHints: sttDiagnostics.languageHints,
          sttClose: sttContext.close,
          teacherSttProvider: teacherSttContext.config?.provider,
          teacherSttUrl: teacherSttContext.config?.url,
          teacherSttModel: teacherSttContext.config?.config.model,
          teacherSttSampleRate: teacherSttDiagnostics.sampleRate,
          teacherSttAudioFormat: teacherSttDiagnostics.audioFormat,
          teacherSttLanguageHints: teacherSttDiagnostics.languageHints,
          teacherSttClose: teacherSttContext.close,
          ttsVoiceId: options.ttsVoiceId,
          ttsModelId: options.ttsModelId,
          ttsLanguageCode: options.ttsLanguageCode,
          ttsOutputFormat: options.ttsOutputFormat,
          network: getNetworkContext(),
          ...details,
        },
      })
      await stopRef.current('error')
    },
    [
      logEventMutation,
      options.mode,
      options.conversationMode,
      options.sourceLanguage,
      options.targetLanguage,
    ],
  )

  useEffect(() => {
    coachErrorRef.current = (err) => {
      void failSession(err, 'Unable to generate a response.', 'tts')
    }
  }, [failSession])

  const enqueueCoachReply = useCallback(() => {
    if (isDualStreamMode) {
      return
    }
    const turnId = getTurnId()
    coachReplyQueueRef.current = coachReplyQueueRef.current
      .then(async () => {
        const activeSessionId = sessionIdRef.current
        if (!activeSessionId || isStopRequested()) {
          return
        }
        if (activeCoachStreamRef.current) {
          return
        }

        await turnSyncRef.current

        coachReplyInFlightRef.current = turnId
        try {
          const replyStream = await startCoachReplyStream({
            sessionId: activeSessionId,
            turnId,
          })

          if (isStopRequested() || getTurnId() !== turnId) {
            await cancelCoachReplyStream({ eventId: replyStream.eventId })
            return
          }

          setActiveCoachStreamId(replyStream.streamId)
          activeCoachStreamRef.current = replyStream.streamId
          activeCoachEventRef.current = replyStream.eventId
        } finally {
          coachReplyInFlightRef.current = null
        }
      })
      .catch((err) => {
        console.error('Coach reply failed', err)
        void failSession(err, 'Unable to start coach response.', 'convex')
      })
  }, [
    cancelCoachReplyStream,
    failSession,
    getTurnId,
    isDualStreamMode,
    isStopRequested,
    startCoachReplyStream,
  ])

  const coachReplyGapMs = useMemo(() => getCoachResponseGapMs(), [])
  const coachInterruptionHoldMs = useMemo(
    () => getCoachInterruptionHoldMs(),
    [],
  )

  const clearDualLearnerFlushSchedule = useCallback(() => {
    if (!dualLearnerFlushTimerRef.current) {
      return
    }
    clearTimeout(dualLearnerFlushTimerRef.current)
    dualLearnerFlushTimerRef.current = null
  }, [])

  const clearDualTeacherFlushSchedule = useCallback(() => {
    if (!dualTeacherFlushTimerRef.current) {
      return
    }
    clearTimeout(dualTeacherFlushTimerRef.current)
    dualTeacherFlushTimerRef.current = null
  }, [])

  const appendUserTranscript = useCallback(
    (segmentSessionId: Id<'speakingSessions'>, text: string) => {
      if (
        sessionIdRef.current !== segmentSessionId ||
        stopInProgressRef.current
      ) {
        return
      }
      const cleaned = sanitizeSpeechText(text)
      if (!cleaned) {
        return
      }
      markTurnActive()

      userTranscriptQueueRef.current = userTranscriptQueueRef.current
        .then(async () => {
          const activeSessionId = sessionIdRef.current
          if (!activeSessionId || stopInProgressRef.current) {
            return
          }

          const nextText = userTranscriptRef.current.text
            ? `${userTranscriptRef.current.text} ${cleaned}`
            : cleaned
          const upsertStartedAt = Date.now()
          emitLatencyTelemetry('transcript_upsert_start', {
            role: 'learner',
            textChars: nextText.length,
            hasEventId: Boolean(userTranscriptRef.current.eventId),
          })

          const result = await upsertUserTranscript({
            sessionId: activeSessionId,
            eventId: userTranscriptRef.current.eventId ?? undefined,
            text: nextText,
            provider: sttContextRef.current.config?.provider,
            turnId: getTurnId(),
            speaker: 'user',
          })

          userTranscriptRef.current = {
            eventId: result.eventId,
            text: nextText,
          }
          emitLatencyTelemetry('transcript_upsert_done', {
            role: 'learner',
            textChars: nextText.length,
            upsertMs: Date.now() - upsertStartedAt,
            eventId: String(result.eventId),
          })
        })
        .catch((err) => {
          console.error('Failed to append transcript', err)
          emitLatencyTelemetry('transcript_upsert_failed', {
            role: 'learner',
            error: serializeError(err),
          })
        })
    },
    [
      emitLatencyTelemetry,
      getTurnId,
      markTurnActive,
      sanitizeSpeechText,
      upsertUserTranscript,
    ],
  )

  const flushUserTranscript = useCallback(
    async ({ resetAfterFlush = false }: { resetAfterFlush?: boolean } = {}) => {
      await userTranscriptQueueRef.current

      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || stopInProgressRef.current) {
        resetUserTranscript()
        return
      }

      const combined = sanitizeSpeechText(userTranscriptRef.current.text)
      const transcriptEventId = userTranscriptRef.current.eventId

      if (!combined || !transcriptEventId) {
        if (resetAfterFlush) {
          resetUserTranscript()
        }
        return
      }

      emitLatencyTelemetry('transcript_flush_started', {
        role: 'learner',
        textChars: combined.length,
        transcriptEventId: String(transcriptEventId),
      })
      dispatchLearnerInsights({
        request: {
          sessionId: activeSessionId,
          text: combined,
          transcriptEventId,
        },
        requestCorrections,
        requestVocabulary,
        emitLatencyTelemetry,
        serializeError,
      })
      if (resetAfterFlush) {
        resetUserTranscript()
      }
    },
    [
      dispatchLearnerInsights,
      emitLatencyTelemetry,
      requestCorrections,
      requestVocabulary,
      resetUserTranscript,
      sanitizeSpeechText,
      serializeError,
    ],
  )

  const appendTeacherTranscript = useCallback(
    (segmentSessionId: Id<'speakingSessions'>, text: string) => {
      if (
        sessionIdRef.current !== segmentSessionId ||
        stopInProgressRef.current ||
        !isDualStreamMode
      ) {
        return
      }

      const cleaned = sanitizeSpeechText(text)
      if (!cleaned) {
        return
      }

      teacherTranscriptQueueRef.current = teacherTranscriptQueueRef.current
        .then(async () => {
          const activeSessionId = sessionIdRef.current
          if (!activeSessionId || stopInProgressRef.current) {
            return
          }

          const nextText = teacherTranscriptRef.current.text
            ? `${teacherTranscriptRef.current.text} ${cleaned}`
            : cleaned
          const upsertStartedAt = Date.now()
          emitLatencyTelemetry('transcript_upsert_start', {
            role: 'teacher',
            textChars: nextText.length,
            hasEventId: Boolean(teacherTranscriptRef.current.eventId),
          })

          const result = await upsertUserTranscript({
            sessionId: activeSessionId,
            eventId: teacherTranscriptRef.current.eventId ?? undefined,
            text: nextText,
            provider: teacherSttContextRef.current.config?.provider,
            turnId: getTurnId(),
            speaker: 'teacher',
          })

          teacherTranscriptRef.current = {
            eventId: result.eventId,
            text: nextText,
          }
          emitLatencyTelemetry('transcript_upsert_done', {
            role: 'teacher',
            textChars: nextText.length,
            upsertMs: Date.now() - upsertStartedAt,
            eventId: String(result.eventId),
          })
        })
        .catch((err) => {
          console.error('Failed to append teacher transcript', err)
          emitLatencyTelemetry('transcript_upsert_failed', {
            role: 'teacher',
            error: serializeError(err),
          })
        })
    },
    [
      emitLatencyTelemetry,
      getTurnId,
      isDualStreamMode,
      sanitizeSpeechText,
      upsertUserTranscript,
    ],
  )

  const flushTeacherTranscript = useCallback(async () => {
    await teacherTranscriptQueueRef.current

    const activeSessionId = sessionIdRef.current
    if (!activeSessionId || stopInProgressRef.current) {
      resetTeacherTranscript()
      return
    }

    const combined = sanitizeSpeechText(teacherTranscriptRef.current.text)
    const transcriptEventId = teacherTranscriptRef.current.eventId

    if (!combined || !transcriptEventId) {
      resetTeacherTranscript()
      return
    }

    const flushStartedAt = Date.now()
    try {
      emitLatencyTelemetry('transcript_flush_started', {
        role: 'teacher',
        textChars: combined.length,
        transcriptEventId: String(transcriptEventId),
      })
      await analyzeVocabulary({
        sessionId: activeSessionId,
        text: combined,
        transcriptEventId,
        excludeText: '',
      })
      emitLatencyTelemetry('transcript_flush_done', {
        role: 'teacher',
        textChars: combined.length,
        transcriptEventId: String(transcriptEventId),
        analyzer: 'vocabulary',
        analyzerMs: Date.now() - flushStartedAt,
      })
    } catch (err) {
      console.error('Teacher vocabulary analysis failed', err)
      emitLatencyTelemetry('transcript_flush_failed', {
        role: 'teacher',
        analyzer: 'vocabulary',
        analyzerMs: Date.now() - flushStartedAt,
        error: serializeError(err),
      })
    } finally {
      resetTeacherTranscript()
    }
  }, [
    analyzeVocabulary,
    emitLatencyTelemetry,
    resetTeacherTranscript,
    sanitizeSpeechText,
  ])

  const cancelPendingCoachReply = useCallback(() => {
    if (isDualStreamMode) {
      return
    }

    const nextTurnId = invalidateTurn()
    syncActiveTurnId(nextTurnId)

    const activeEventId = activeCoachEventRef.current
    activeCoachEventRef.current = null
    activeCoachStreamRef.current = null
    setActiveCoachStreamId(null)
    lastCoachAudioActivityAtRef.current = null

    if (activeEventId) {
      cancelCoachReplyStream({ eventId: activeEventId }).catch((err) => {
        console.error('Failed to cancel coach reply', err)
      })
    }
  }, [
    cancelCoachReplyStream,
    invalidateTurn,
    isDualStreamMode,
    syncActiveTurnId,
  ])

  const handleOutsideCoachHoldWindow = useCallback(() => {
    if (isDualStreamMode) {
      return
    }

    if (isPlaying()) {
      interruptPlayback()
    }
    resetUserTranscript()
    const nextTurnId = advanceTurn()
    syncActiveTurnId(nextTurnId)
    setActiveCoachStreamId(null)
    activeCoachStreamRef.current = null
    activeCoachEventRef.current = null
    lastCoachAudioActivityAtRef.current = null
  }, [
    advanceTurn,
    interruptPlayback,
    isDualStreamMode,
    isPlaying,
    resetUserTranscript,
    syncActiveTurnId,
  ])

  const handleSingleStreamTurnReady = useCallback(async () => {
    markTurnFinalized()
    await flushUserTranscript()
    enqueueCoachReply()
  }, [enqueueCoachReply, flushUserTranscript, markTurnFinalized])

  const handleSingleStreamTurnError = useCallback(
    (err: unknown) => {
      console.error('Coach turn orchestration failed', err)
      void failSession(err, 'Unable to start coach response.', 'convex')
    },
    [failSession],
  )

  const getSingleStreamTurnController = useCallback(() => {
    if (!singleStreamTurnControllerRef.current) {
      singleStreamTurnControllerRef.current =
        createSpeakingSessionSingleStreamTurnController({
          responseGapMs: coachReplyGapMs,
          interruptionHoldMs: coachInterruptionHoldMs,
          observer,
          getConversationIdentity: () => {
            const activeSessionId = sessionIdRef.current
            return activeSessionId ? String(activeSessionId) : null
          },
          isStopRequested,
          isPlaybackActive: () => !isDualStreamMode && isPlaying(),
          hasPendingReply: () => Boolean(coachReplyInFlightRef.current),
          getActiveReplyId: () =>
            activeCoachStreamRef.current
              ? String(activeCoachStreamRef.current)
              : coachReplyInFlightRef.current
                ? `pending_turn:${coachReplyInFlightRef.current}`
                : null,
          getLastAssistantActivityAt: () => lastCoachAudioActivityAtRef.current,
          interruptPlayback: () => {
            if (!isDualStreamMode) {
              interruptPlayback()
            }
          },
        })
    }

    return singleStreamTurnControllerRef.current
  }, [
    coachInterruptionHoldMs,
    coachReplyGapMs,
    interruptPlayback,
    isDualStreamMode,
    isPlaying,
    isStopRequested,
    observer,
  ])

  const singleStreamTurnController = getSingleStreamTurnController()
  singleStreamTurnController.setCallbacks({
    onTurnReady: async (_args) => {
      await handleSingleStreamTurnReady()
    },
    onOutsideHoldWindow: handleOutsideCoachHoldWindow,
    onCancelPendingReply: cancelPendingCoachReply,
    onError: (err, _args) => {
      handleSingleStreamTurnError(err)
    },
  })

  const scheduleDualLearnerFlush = useCallback(() => {
    if (!isDualStreamMode) {
      return
    }
    if (stopInProgressRef.current || !sessionIdRef.current) {
      clearDualLearnerFlushSchedule()
      return
    }

    if (coachReplyGapMs <= 0) {
      void flushUserTranscript({ resetAfterFlush: true })
      return
    }
    emitLatencyTelemetry('transcript_flush_scheduled', {
      role: 'learner',
      delayMs: coachReplyGapMs,
      trigger: 'dual_stream_idle_gap',
    })

    clearDualLearnerFlushSchedule()
    dualLearnerFlushTimerRef.current = setTimeout(() => {
      dualLearnerFlushTimerRef.current = null
      if (stopInProgressRef.current || !sessionIdRef.current) {
        return
      }
      void flushUserTranscript({ resetAfterFlush: true })
    }, coachReplyGapMs)
  }, [
    clearDualLearnerFlushSchedule,
    coachReplyGapMs,
    flushUserTranscript,
    isDualStreamMode,
  ])

  const scheduleDualTeacherFlush = useCallback(() => {
    if (!isDualStreamMode) {
      return
    }
    if (stopInProgressRef.current || !sessionIdRef.current) {
      clearDualTeacherFlushSchedule()
      return
    }

    if (coachReplyGapMs <= 0) {
      void flushTeacherTranscript()
      return
    }
    emitLatencyTelemetry('transcript_flush_scheduled', {
      role: 'teacher',
      delayMs: coachReplyGapMs,
      trigger: 'dual_stream_idle_gap',
    })

    clearDualTeacherFlushSchedule()
    dualTeacherFlushTimerRef.current = setTimeout(() => {
      dualTeacherFlushTimerRef.current = null
      if (stopInProgressRef.current || !sessionIdRef.current) {
        return
      }
      void flushTeacherTranscript()
    }, coachReplyGapMs)
  }, [
    clearDualTeacherFlushSchedule,
    coachReplyGapMs,
    flushTeacherTranscript,
    isDualStreamMode,
  ])

  const handleSpeechActivity = useCallback(
    ({
      sessionId: activeSessionId,
      text,
    }: {
      sessionId: Id<'speakingSessions'>
      text: string
    }) => {
      markSpeechActivity('learner', text)
      if (isDualStreamMode) {
        clearDualLearnerFlushSchedule()
        return
      }
      if (stopInProgressRef.current) {
        return
      }
      if (sessionIdRef.current !== activeSessionId) {
        return
      }

      markTurnActive()
      singleStreamTurnControllerRef.current?.onSpeechActivity(text)
    },
    [
      clearDualLearnerFlushSchedule,
      markSpeechActivity,
      isDualStreamMode,
      markTurnActive,
    ],
  )

  const stopMedia = useCallback(() => {
    setActiveCoachStreamId(null)
    activeCoachStreamRef.current = null
    activeCoachEventRef.current = null
    lastCoachAudioActivityAtRef.current = null
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
    if (teacherRecorderRef.current) {
      teacherRecorderRef.current.stop()
      teacherRecorderRef.current = null
    }

    singleStreamTurnControllerRef.current?.cancel('stop_media')
    clearDualLearnerFlushSchedule()
    clearDualTeacherFlushSchedule()
    resetPlayback()
    stopSttRef.current()
    stopTeacherSttRef.current()
    usageResetRef.current()
    resetUserTranscript()
    resetTeacherTranscript()
    resetTurn()
    learnerSttRecoveryRef.current = 'stable'
    teacherSttRecoveryRef.current = 'stable'
    setTranscriptionNotice(null)

    coachReplyInFlightRef.current = null
    coachReplyQueueRef.current = Promise.resolve()
    turnSyncRef.current = Promise.resolve()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (teacherStreamRef.current) {
      teacherStreamRef.current.getTracks().forEach((track) => track.stop())
      teacherStreamRef.current = null
    }
  }, [
    clearDualLearnerFlushSchedule,
    clearDualTeacherFlushSchedule,
    lastCoachAudioActivityAtRef,
    resetPlayback,
    resetTeacherTranscript,
    resetTurn,
    resetUserTranscript,
  ])

  const requestResume = useCallback(
    (role: 'learner' | 'teacher') => {
      if (stopInProgressRef.current) {
        return
      }

      stopInProgressRef.current = true
      setResumeAvailable(true)
      setStatus('error')
      setError(
        `${
          role === 'teacher' ? 'Teacher' : 'Learner'
        } audio stream ended. Click Resume to reconnect.`,
      )
      const activeSessionId = sessionIdRef.current
      if (activeSessionId) {
        void pauseSession({ sessionId: activeSessionId }).catch((err) => {
          console.error('Failed to pause session', err)
        })
      }
      stopMedia()
      stopInProgressRef.current = false
    },
    [pauseSession, stopMedia],
  )

  const handleUsageError = useCallback(
    (err: unknown) => {
      console.error('Failed to ingest audio chunk', err)
      void failSession(
        err,
        'Unable to stream audio. Please try again.',
        'network',
      )
    },
    [failSession],
  )

  const { queueUsage, reset: resetUsage } = useUsageTracker({
    ingestAudioChunk,
    getActiveSessionId,
    isStopRequested,
    onUsageUpdate: (nextUsageMs, nextLimitMs) => {
      setUsageMs(nextUsageMs)
      setLimitMs(nextLimitMs)
    },
    onLimitReached: async () => {
      await stopRef.current('limit')
    },
    onError: handleUsageError,
  })

  usageResetRef.current = resetUsage

  const handleLearnerSttReady = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) {
      return
    }
    void recorder.start().then(
      () => {
        emitLatencyTelemetry('stt_ready', { role: 'learner' })
        setStatus('active')
      },
      (err) => {
        void failSession(err, 'Unable to start audio capture.', 'media')
      },
    )
  }, [emitLatencyTelemetry, failSession])

  const handleTeacherSttReady = useCallback(() => {
    const recorder = teacherRecorderRef.current
    if (!recorder) {
      return
    }
    void recorder.start().then(
      () => {
        emitLatencyTelemetry('stt_ready', { role: 'teacher' })
        setStatus('active')
      },
      (err) => {
        void failSession(err, 'Unable to start teacher audio capture.', 'media')
      },
    )
  }, [emitLatencyTelemetry, failSession])

  const handleSttError = useCallback(
    (sttError: unknown, details: { sttClose: SttCloseInfo | null }) => {
      console.error('STT error', sttError)
      void failSession(
        sttError,
        'Live transcription stopped unexpectedly.',
        'stt',
        details,
      )
    },
    [failSession],
  )

  const emitSttConnectionLifecycle = useCallback(
    (role: 'learner' | 'teacher', args: SttLifecycleEvent) => {
      emitLatencyTelemetry('stt_connection_lifecycle', {
        role,
        stage: args.stage,
        provider: args.provider,
        delayMs: args.delayMs ?? null,
        ttlMs: args.ttlMs ?? null,
        closeCode: args.closeInfo?.code ?? null,
        closeReason: args.closeInfo?.reason ?? null,
        closeWasClean: args.closeInfo?.wasClean ?? null,
      })
    },
    [emitLatencyTelemetry],
  )

  const {
    startStt: startLearnerStt,
    stopStt: stopLearnerStt,
    sendAudio: sendLearnerAudio,
    isReady: isLearnerSttReady,
  } = useSttPipeline({
    createSttSession,
    getActiveSessionId,
    isStopRequested,
    isPlaybackActive: () => !isDualStreamMode && isPlaying(),
    haltPlayback: () => {
      if (!isDualStreamMode) {
        haltPlayback()
      }
    },
    onSpeechActivity: handleSpeechActivity,
    onTranscript: ({ sessionId: activeSessionId, text }) => {
      const now = Date.now()
      const probe = consumeSpeechProbe('learner')
      emitLatencyTelemetry('stt_final_transcript', {
        role: 'learner',
        textChars: text.length,
        activityCount: probe.activityCount,
        speechToFinalMs: probe.startedAt ? now - probe.startedAt : null,
      })
      appendUserTranscript(activeSessionId, text)
      if (!isDualStreamMode) {
        singleStreamTurnControllerRef.current?.onFinalTranscript(text)
      }
    },
    onTranscriptComplete: () => {
      if (isDualStreamMode) {
        scheduleDualLearnerFlush()
        return
      }
      singleStreamTurnControllerRef.current?.onTranscriptComplete()
    },
    onError: handleSttError,
    onReady: handleLearnerSttReady,
    onRecoveryStateChange: ({ state, reason, attempt, delayMs }) => {
      learnerSttRecoveryRef.current = state
      updateTranscriptionNotice()
      emitLatencyTelemetry('stt_recovery_state', {
        role: 'learner',
        state,
        reason,
        attempt,
        delayMs: delayMs ?? null,
      })
    },
    onConnectionLifecycleEvent: (args) => {
      emitSttConnectionLifecycle('learner', args)
    },
    sttContextRef,
  })

  const {
    startStt: startTeacherStt,
    stopStt: stopTeacherStt,
    sendAudio: sendTeacherAudio,
    isReady: isTeacherSttReady,
  } = useSttPipeline({
    createSttSession,
    getActiveSessionId,
    isStopRequested,
    isPlaybackActive: () => false,
    haltPlayback: () => {},
    onTranscript: ({ sessionId: activeSessionId, text }) => {
      const now = Date.now()
      const probe = consumeSpeechProbe('teacher')
      emitLatencyTelemetry('stt_final_transcript', {
        role: 'teacher',
        textChars: text.length,
        activityCount: probe.activityCount,
        speechToFinalMs: probe.startedAt ? now - probe.startedAt : null,
      })
      appendTeacherTranscript(activeSessionId, text)
    },
    onTranscriptComplete: () => {
      if (!isDualStreamMode) {
        return
      }
      scheduleDualTeacherFlush()
    },
    onSpeechActivity: ({ text }) => {
      markSpeechActivity('teacher', text)
      if (!isDualStreamMode) {
        return
      }
      clearDualTeacherFlushSchedule()
    },
    onError: (sttError, details) => {
      handleSttError(sttError, details)
    },
    onReady: handleTeacherSttReady,
    onRecoveryStateChange: ({ state, reason, attempt, delayMs }) => {
      teacherSttRecoveryRef.current = state
      updateTranscriptionNotice()
      emitLatencyTelemetry('stt_recovery_state', {
        role: 'teacher',
        state,
        reason,
        attempt,
        delayMs: delayMs ?? null,
      })
    },
    onConnectionLifecycleEvent: (args) => {
      emitSttConnectionLifecycle('teacher', args)
    },
    sttContextRef: teacherSttContextRef,
  })

  stopSttRef.current = stopLearnerStt
  stopTeacherSttRef.current = stopTeacherStt

  const enqueueCoachSegment = useCallback(
    (streamId: string, segment: string, _isFinal: boolean) => {
      const cleaned = sanitizeSpeechText(segment)
      if (!cleaned) {
        return
      }
      if (!streamId || streamId !== activeCoachStreamRef.current) {
        return
      }
      lastCoachAudioActivityAtRef.current = Date.now()
      speakCoachText(cleaned)
    },
    [speakCoachText],
  )

  const completeCoachStream = useCallback(
    (streamId: string) => {
      if (!streamId) {
        return
      }
      if (streamId === activeCoachStreamRef.current) {
        setActiveCoachStreamId(null)
        activeCoachStreamRef.current = null
        activeCoachEventRef.current = null
        lastCoachAudioActivityAtRef.current = null

        if (isTurnFinalized()) {
          resetUserTranscript()
          const nextTurnId = advanceTurn()
          syncActiveTurnId(nextTurnId)
        }
      }
    },
    [advanceTurn, isTurnFinalized, resetUserTranscript, syncActiveTurnId],
  )

  const setStream = useCallback((stream: MediaStream | null) => {
    streamRef.current = stream
  }, [])

  const handleSessionStart = useCallback(
    async ({
      stream,
      session,
    }: {
      stream: MediaStream
      session: { sessionId: Id<'speakingSessions'> }
    }) => {
      if (!isDualStreamMode) {
        initPlayback()
        const started = getSingleStreamTurnController().start()
        if (!started) {
          throw new Error('Unable to initialize turn orchestration.')
        }
      }

      const attachTrackFailure = (
        value: MediaStream,
        role: 'learner' | 'teacher',
      ) => {
        const audioTrack = value.getAudioTracks().at(0)
        if (!audioTrack) {
          throw new Error(`${role} audio stream is missing an audio track.`)
        }
        audioTrack.onended = () => {
          if (stopInProgressRef.current) {
            return
          }
          requestResume(role)
        }
      }

      attachTrackFailure(stream, 'learner')

      let audioSampleRate = DEFAULT_SAMPLE_RATE
      const recorder = createPcmRecorder(stream, {
        sampleRate: DEFAULT_SAMPLE_RATE,
        onAudio: (payload, frameCount) => {
          const currentSessionId = sessionIdRef.current
          if (!currentSessionId || stopInProgressRef.current) {
            return
          }
          if (!isDualStreamMode && isPlaying()) {
            return
          }
          if (!isLearnerSttReady()) {
            return
          }
          if (!frameCount) {
            return
          }

          sendLearnerAudio(payload)

          const chunkMs = Math.max(
            0,
            Math.round((frameCount / audioSampleRate) * 1000),
          )

          if (chunkMs) {
            queueUsage(currentSessionId, chunkMs)
          }
        },
        onError: (err) => {
          void failSession(err, 'Audio capture failed.', 'media')
        },
      })
      audioSampleRate = recorder.sampleRate

      recorderRef.current = recorder
      await startLearnerStt({
        sessionId: session.sessionId,
        sampleRate: audioSampleRate,
        language: options.sttLanguage,
        model: options.sttModel,
      })

      if (!isDualStreamMode) {
        return
      }

      if (
        teacherInputSourceMethod === 'device' &&
        !options.teacherInputDeviceId
      ) {
        throw new Error('Select a teacher audio source before starting.')
      }

      const teacherStream = await acquireTeacherAudioStream({
        method: teacherInputSourceMethod,
        deviceId: options.teacherInputDeviceId,
      })

      teacherStreamRef.current = teacherStream
      attachTrackFailure(teacherStream, 'teacher')

      let teacherAudioSampleRate = DEFAULT_SAMPLE_RATE
      const teacherRecorder = createPcmRecorder(teacherStream, {
        sampleRate: DEFAULT_SAMPLE_RATE,
        onAudio: (payload, frameCount) => {
          if (!sessionIdRef.current || stopInProgressRef.current) {
            return
          }
          if (!isTeacherSttReady() || !frameCount) {
            return
          }

          sendTeacherAudio(payload)
        },
        onError: (err) => {
          void failSession(err, 'Teacher audio capture failed.', 'media')
        },
      })

      teacherAudioSampleRate = teacherRecorder.sampleRate
      teacherRecorderRef.current = teacherRecorder

      await startTeacherStt({
        sessionId: session.sessionId,
        sampleRate: teacherAudioSampleRate,
        language: options.sttLanguage,
        model: options.sttModel,
      })
    },
    [
      failSession,
      getSingleStreamTurnController,
      initPlayback,
      isDualStreamMode,
      isPlaying,
      isLearnerSttReady,
      isTeacherSttReady,
      options.sttLanguage,
      options.sttModel,
      teacherInputSourceMethod,
      options.teacherInputDeviceId,
      queueUsage,
      sendLearnerAudio,
      sendTeacherAudio,
      startLearnerStt,
      startTeacherStt,
    ],
  )

  const startSessionWithTurnId = useCallback(
    (args: Parameters<typeof startSession>[0]) =>
      startSession({ ...args, turnId: getTurnId() }),
    [getTurnId, startSession],
  )

  const {
    start: startLifecycle,
    stop,
    reset,
  } = useSessionLifecycle({
    options,
    status,
    setStatus,
    setMode,
    setSessionId,
    setUsageMs,
    setLimitMs,
    setError,
    detectAudioSupport,
    setSupportStatus,
    setMicPermission,
    startSession: startSessionWithTurnId,
    endSession,
    stopMedia,
    onSessionStart: handleSessionStart,
    onFailure: failSession,
    sessionIdRef,
    stopInProgressRef,
    setStream,
  })

  const resume = useCallback(async () => {
    if (!resumeAvailable) {
      return
    }

    clearResumeState()
    setError(null)

    const supported = detectAudioSupport()
    if (!supported) {
      setSupportStatus('unsupported')
      setMicPermission('unsupported')
      setError('Audio capture is not supported in this browser.')
      setStatus('error')
      return
    }
    setSupportStatus('supported')

    if (!sessionIdRef.current) {
      await startLifecycle()
      return
    }

    if (
      isDualStreamMode &&
      teacherInputSourceMethod === 'device' &&
      !options.teacherInputDeviceId
    ) {
      setError('Select a teacher audio source before resuming.')
      setResumeAvailable(true)
      return
    }

    setStatus('requesting_mic')

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options.learnerInputDeviceId
          ? { deviceId: { exact: options.learnerInputDeviceId } }
          : true,
      })
      streamRef.current = stream
      setMicPermission('granted')
    } catch (err) {
      console.error('Unable to access microphone', err)
      setMicPermission('denied')
      setError('Microphone access is required to resume.')
      setStatus('error')
      setResumeAvailable(true)
      return
    }

    try {
      setStatus('starting')
      await handleSessionStart({
        stream,
        session: { sessionId: sessionIdRef.current },
      })
      if (sessionIdRef.current) {
        void resumeSession({ sessionId: sessionIdRef.current }).catch((err) => {
          console.error('Failed to resume session', err)
        })
      }
    } catch (err) {
      console.error('Unable to resume session', err)
      setError('Unable to resume session.')
      setStatus('error')
      setResumeAvailable(true)
    }
  }, [
    clearResumeState,
    detectAudioSupport,
    handleSessionStart,
    isDualStreamMode,
    options.learnerInputDeviceId,
    teacherInputSourceMethod,
    options.teacherInputDeviceId,
    resumeSession,
    resumeAvailable,
    setMicPermission,
    setSupportStatus,
    startLifecycle,
  ])

  const start = useCallback(async () => {
    resetTurn()
    await startLifecycle()
  }, [resetTurn, startLifecycle])

  stopRef.current = stop

  useEffect(() => {
    return () => {
      void stopRef.current()
    }
  }, [])
  useEffect(() => {
    return () => {
      const controller = singleStreamTurnControllerRef.current
      controller?.dispose()
      if (singleStreamTurnControllerRef.current === controller) {
        singleStreamTurnControllerRef.current = null
      }
    }
  }, [])

  const resetWithResumeClear = useCallback(() => {
    clearResumeState()
    reset()
  }, [clearResumeState, reset])

  const stopWithResumeClear = useCallback(async () => {
    clearResumeState()
    await stop()
  }, [clearResumeState, stop])

  return {
    status,
    mode,
    sessionId,
    activeCoachStreamId,
    usageMs,
    limitMs,
    remainingMs,
    error,
    transcriptionNotice,
    micPermission,
    isSupported,
    isActive: status === 'active',
    canResume: resumeAvailable,
    start,
    resume,
    stop: stopWithResumeClear,
    enqueueCoachSegment,
    completeCoachStream,
    reset: resetWithResumeClear,
  }
}

export const useSpeakingSessionFeed = (
  sessionId: Id<'speakingSessions'> | null,
  limit = 80,
): Array<SpeakingEvent> | undefined =>
  useQuery(
    api.speaking.getSessionFeed,
    sessionId ? { sessionId, limit } : 'skip',
  )
