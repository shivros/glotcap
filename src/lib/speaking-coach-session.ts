import { useAction, useMutation } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLatencyTelemetryBatcher } from 'ts-common/logging/latency-batcher'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import type {
  LiveTranslationRequestContext,
  LiveTranslationTelemetryEvent,
} from '@/lib/live-translation-coordinator'
import type { SpeakingSessionOptions } from '@/lib/speaking-session-types'
import type {
  TranslationPreferences,
  TranslationRole,
} from '@/lib/translation-preferences'
import {
  useSpeakingSession,
  useSpeakingSessionFeed,
} from '@/lib/speaking-session'
import { resolveConvexSiteUrl } from '@/lib/convex-site'
import { LiveTranslationCoordinator } from '@/lib/live-translation-coordinator'
import { sanitizeSpeechText } from '@/lib/speaking-session-text'
import { observeTranscriptUpdates } from '@/lib/translation-feed-observer'
import {
  hasEnabledTranslationMode,
  isTranslationModeEnabled,
  normalizeTranslationPreferences,
  roleForSpeaker,
} from '@/lib/translation-preferences'
import { getConversationModeStatusLabel } from '@/lib/speaking-coach-mode-config'
import { useTranslationPersistence } from '@/lib/use-translation-persistence'

export type CoachTranscriptLine = {
  speaker: string
  text: string
}

export type CoachCorrectionNote = {
  type: 'fix' | 'good'
  title: string
  detail: string
}

export type CoachVocabularyNote = {
  word: string
  definition: string
}

type UseSpeakingCoachSessionParams = {
  sessionOptions: SpeakingSessionOptions
  translationTargetLanguage: string
  initialTranslationPreferences?: Partial<TranslationPreferences>
  fallbackTranscript: Array<CoachTranscriptLine>
  fallbackCorrections: Array<CoachCorrectionNote>
  limitReachedLabel?: string
  displayLimitMsOverride?: number
}

type SpeakingCoachSessionState = {
  session: ReturnType<typeof useSpeakingSession>
  feed: Array<Doc<'speakingEvents'>> | null
  transcriptEvents: Array<Doc<'speakingEvents'>> | null
  transcriptLines: Array<CoachTranscriptLine>
  correctionsList: Array<CoachCorrectionNote>
  vocabularyList: Array<CoachVocabularyNote>
  translations: Record<string, string>
  translationPreferences: TranslationPreferences
  setTranslationPreferences: React.Dispatch<
    React.SetStateAction<TranslationPreferences>
  >
  coachStreamUrl: URL
  handleStreamDelta: (streamId: string, delta: string) => void
  handleStreamComplete: (streamId: string, text: string, status: string) => void
  handleStreamSegment: (
    streamId: string,
    segment: string,
    isFinal: boolean,
  ) => void
  handlePrimaryClick: () => Promise<void>
  statusLabel: string
  isBusy: boolean
  isActive: boolean
  isLimitReached: boolean
  isStartDisabled: boolean
  usedMs: number
  remainingMs: number
  displayLimitMs: number
  progressPct: number
}

export const useSpeakingCoachSession = ({
  sessionOptions,
  translationTargetLanguage,
  initialTranslationPreferences,
  fallbackTranscript,
  fallbackCorrections,
  limitReachedLabel = 'Limit reached',
  displayLimitMsOverride,
}: UseSpeakingCoachSessionParams): SpeakingCoachSessionState => {
  const session = useSpeakingSession(sessionOptions)
  const feed = useSpeakingSessionFeed(session.sessionId) ?? null
  const conversationMode = sessionOptions.conversationMode ?? 'coach'
  const translateSegment = useAction(api.translations.translateSegment)
  const logEventMutation = useMutation(api.logging.logEvent)
  const [translationPreferences, setTranslationPreferences] =
    useState<TranslationPreferences>(() =>
      normalizeTranslationPreferences(initialTranslationPreferences),
    )
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const translationCoordinatorRef = useRef<LiveTranslationCoordinator | null>(
    null,
  )
  const translationPreferencesRef = useRef(translationPreferences)
  const telemetryBatcherRef = useRef<ReturnType<
    typeof createLatencyTelemetryBatcher
  > | null>(null)
  const observedSourceSnapshotsRef = useRef<Map<string, string>>(new Map())
  const sourceRolesRef = useRef<Map<string, TranslationRole>>(new Map())
  const previousTranslationPreferencesRef = useRef(translationPreferences)
  const translationPersistence = useTranslationPersistence(feed)

  const convexSiteUrl = resolveConvexSiteUrl(
    import.meta.env.VITE_CONVEX_URL as string,
    import.meta.env.VITE_CONVEX_SITE_URL as string | undefined,
  )
  const coachStreamUrl = useMemo(
    () => new URL('/coach-stream', convexSiteUrl),
    [convexSiteUrl],
  )
  const telemetryEnabled =
    (import.meta.env.VITE_LATENCY_TELEMETRY as string | undefined) !== 'false'

  const translateCounterpart = useCallback(
    async (text: string, context?: LiveTranslationRequestContext) => {
      const result = await translateSegment({
        text,
        sourceLanguage: sessionOptions.targetLanguage,
        targetLanguage: translationTargetLanguage,
        sessionId: session.sessionId ? String(session.sessionId) : undefined,
        sourceId: context?.sourceId,
        reason: context?.reason,
        revision: context?.revision,
      })
      return result.text
    },
    [
      session.sessionId,
      sessionOptions.targetLanguage,
      translateSegment,
      translationTargetLanguage,
    ],
  )

  const persistTranslationRef = useRef(translationPersistence.persist)
  useEffect(() => {
    persistTranslationRef.current = translationPersistence.persist
  }, [translationPersistence.persist])

  useEffect(() => {
    translationPreferencesRef.current = translationPreferences
  }, [translationPreferences])

  useEffect(() => {
    const batcher = createLatencyTelemetryBatcher({
      enabled: telemetryEnabled,
      source: 'speaking-coach-translation',
      feature: 'translation-latency',
      logEventMutation,
      getSessionId: () =>
        session.sessionId ? String(session.sessionId) : undefined,
    })
    telemetryBatcherRef.current = batcher
    return () => {
      batcher.dispose()
      if (telemetryBatcherRef.current === batcher) {
        telemetryBatcherRef.current = null
      }
    }
  }, [logEventMutation, session.sessionId, telemetryEnabled])

  const emitTranslationTelemetry = useCallback(
    (event: LiveTranslationTelemetryEvent) => {
      telemetryBatcherRef.current?.emit(`translation_${event.stage}`, {
        ...event,
        mode: conversationMode,
        activeStreamId: session.activeCoachStreamId ?? undefined,
        translationModeSelf: translationPreferencesRef.current.self,
        translationModeCounterpart:
          translationPreferencesRef.current.counterpart,
      })
    },
    [conversationMode, session.activeCoachStreamId],
  )

  useEffect(() => {
    const coordinator = new LiveTranslationCoordinator({
      translate: translateCounterpart,
      isEnabled: () =>
        hasEnabledTranslationMode(translationPreferencesRef.current),
      onTelemetry: emitTranslationTelemetry,
      onUpdate: (sourceId, translation) => {
        const role = sourceRolesRef.current.get(sourceId)
        if (!role) {
          return
        }
        const mode = translationPreferencesRef.current[role]
        if (!isTranslationModeEnabled(mode)) {
          return
        }
        setTranslations((prev) => {
          if (prev[sourceId] === translation) {
            return prev
          }
          return {
            ...prev,
            [sourceId]: translation,
          }
        })
        telemetryBatcherRef.current?.emit('translation_render_update', {
          sourceId,
          role,
          translatedChars: translation.length,
          mode: conversationMode,
        })

        persistTranslationRef.current(sourceId, translation)
      },
      onError: (err) => {
        console.error('Translation failed', err)
      },
    })
    translationCoordinatorRef.current = coordinator
    return () => {
      coordinator.reset()
      if (translationCoordinatorRef.current === coordinator) {
        translationCoordinatorRef.current = null
      }
    }
  }, [conversationMode, emitTranslationTelemetry, translateCounterpart])

  const resetTranslations = useCallback(() => {
    setTranslations({})
    translationCoordinatorRef.current?.reset()
    observedSourceSnapshotsRef.current.clear()
    sourceRolesRef.current.clear()
    translationPersistence.reset()
  }, [translationPersistence.reset])

  useEffect(() => {
    resetTranslations()
  }, [
    resetTranslations,
    session.sessionId,
    sessionOptions.targetLanguage,
    translationTargetLanguage,
  ])

  useEffect(() => {
    if (hasEnabledTranslationMode(translationPreferences)) {
      return
    }
    translationCoordinatorRef.current?.clearPending()
  }, [translationPreferences])

  useEffect(() => {
    const previous = previousTranslationPreferencesRef.current
    previousTranslationPreferencesRef.current = translationPreferences

    const disabledRoles = (['self', 'counterpart'] as const).filter(
      (role) =>
        isTranslationModeEnabled(previous[role]) &&
        !isTranslationModeEnabled(translationPreferences[role]),
    )
    if (disabledRoles.length === 0) {
      return
    }

    const disabledSet = new Set<TranslationRole>(disabledRoles)
    translationCoordinatorRef.current?.clearPending()
    setTranslations((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [sourceId, role] of sourceRolesRef.current) {
        if (!disabledSet.has(role) || !(sourceId in next)) {
          continue
        }
        delete next[sourceId]
        changed = true
      }
      return changed ? next : prev
    })
    for (const [sourceId, role] of sourceRolesRef.current) {
      if (!disabledSet.has(role)) {
        continue
      }
      sourceRolesRef.current.delete(sourceId)
      observedSourceSnapshotsRef.current.delete(sourceId)
    }
  }, [translationPreferences])

  useEffect(() => {
    if (!feed || feed.length === 0) {
      return
    }

    const observedSpeakers = new Set<string>()
    if (isTranslationModeEnabled(translationPreferences.counterpart)) {
      observedSpeakers.add('coach')
      observedSpeakers.add('teacher')
    }
    if (isTranslationModeEnabled(translationPreferences.self)) {
      observedSpeakers.add('user')
    }
    if (observedSpeakers.size === 0) {
      return
    }

    const observations = observeTranscriptUpdates({
      feed,
      speakers: observedSpeakers,
      snapshotStore: observedSourceSnapshotsRef.current,
    })

    for (const observation of observations) {
      const role = roleForSpeaker(observation.speaker)
      if (!role) {
        continue
      }
      sourceRolesRef.current.set(observation.sourceId, role)
      telemetryBatcherRef.current?.emit('translation_source_observed', {
        sourceId: observation.sourceId,
        speaker: observation.speaker,
        role,
        sourceChars: observation.sourceChars,
        sourceAgeMs: observation.sourceAgeMs,
        mode: conversationMode,
      })
      translationCoordinatorRef.current?.updateSource(
        observation.sourceId,
        observation.cleanedText,
      )
    }
  }, [conversationMode, feed, translationPreferences])

  const handleStreamDelta = useCallback(
    (streamId: string, delta: string) => {
      if (!streamId || streamId !== session.activeCoachStreamId) {
        return
      }
      const cleaned = sanitizeSpeechText(delta)
      if (!cleaned) {
        return
      }
      sourceRolesRef.current.set(streamId, 'counterpart')
      if (
        !isTranslationModeEnabled(translationPreferencesRef.current.counterpart)
      ) {
        return
      }
      translationCoordinatorRef.current?.appendDelta(streamId, cleaned)
    },
    [session.activeCoachStreamId],
  )

  const handleStreamComplete = useCallback(
    (streamId: string, text: string, _status: string) => {
      if (!streamId || streamId !== session.activeCoachStreamId) {
        return
      }
      session.completeCoachStream(streamId)
      sourceRolesRef.current.set(streamId, 'counterpart')
      if (
        !isTranslationModeEnabled(translationPreferencesRef.current.counterpart)
      ) {
        setTranslations((prev) => {
          if (!(streamId in prev)) {
            return prev
          }
          const next = { ...prev }
          delete next[streamId]
          return next
        })
        return
      }
      translationCoordinatorRef.current?.completeSource(streamId, text)
    },
    [session.activeCoachStreamId, session.completeCoachStream],
  )

  const handleStreamSegment = useCallback(
    (streamId: string, segment: string, isFinal: boolean) => {
      if (!streamId || streamId !== session.activeCoachStreamId) {
        return
      }
      session.enqueueCoachSegment(streamId, segment, isFinal)
    },
    [session.activeCoachStreamId, session.enqueueCoachSegment],
  )

  const transcriptEvents = useMemo(() => {
    if (!feed || feed.length === 0) {
      return null
    }
    return feed.filter(
      (event) =>
        event.type === 'transcript' && event.streamStatus !== 'canceled',
    )
  }, [feed])

  const transcriptLines = useMemo(() => {
    if (!feed || feed.length === 0) {
      if (session.status === 'active' || session.status === 'starting') {
        return [
          {
            speaker: 'Coach',
            text: 'Listening... your transcript will appear here.',
          },
        ]
      }
      return fallbackTranscript
    }

    return feed
      .filter(
        (event) =>
          event.type === 'transcript' && event.streamStatus !== 'canceled',
      )
      .map((event) => ({
        speaker:
          event.speaker === 'user'
            ? 'You'
            : event.speaker === 'teacher'
              ? 'Teacher'
              : event.speaker === 'coach'
                ? 'Coach'
                : 'System',
        text: event.text ?? '',
      }))
      .filter((event) => event.text.length > 0)
  }, [fallbackTranscript, feed, session.status])

  const correctionsList = useMemo<Array<CoachCorrectionNote>>(() => {
    if (!feed || feed.length === 0) {
      return fallbackCorrections
    }

    return feed
      .filter((event) => event.type === 'correction')
      .map((event) => {
        const type: CoachCorrectionNote['type'] =
          event.severity === 'positive' ? 'good' : 'fix'
        return {
          type,
          title: event.title ?? 'Correction',
          detail: event.detail ?? event.text ?? '',
        }
      })
      .filter((event) => event.detail.length > 0)
  }, [feed, fallbackCorrections])

  const vocabularyList = useMemo<Array<CoachVocabularyNote>>(() => {
    if (!feed || feed.length === 0) {
      return []
    }

    return feed
      .filter((event) => event.type === 'vocabulary')
      .map((event) => ({
        word: event.text ?? '',
        definition: event.detail ?? '',
      }))
      .filter((event) => event.word.length > 0 && event.definition.length > 0)
  }, [feed])

  const isBusy =
    session.status === 'requesting_mic' ||
    session.status === 'starting' ||
    session.status === 'ending'
  const isActive = session.status === 'active'
  const isLimitReached = session.status === 'limit_reached'
  const isStartDisabled = isBusy || isLimitReached || !session.isSupported

  const handlePrimaryClick = useCallback(async () => {
    if (isActive) {
      await session.stop()
      return
    }

    if (session.status === 'error') {
      if (session.canResume) {
        await session.resume()
        return
      }
      session.reset()
    }

    await session.start()
  }, [isActive, session])

  const statusLabel = useMemo(() => {
    if (session.status === 'limit_reached') {
      return limitReachedLabel
    }
    if (session.status === 'error') {
      return session.error ?? 'Session error'
    }
    return getConversationModeStatusLabel(
      session.status,
      sessionOptions.conversationMode ?? 'coach',
    )
  }, [
    limitReachedLabel,
    session.error,
    session.status,
    sessionOptions.conversationMode,
  ])

  const displayLimitMs = session.sessionId
    ? session.limitMs
    : (displayLimitMsOverride ?? sessionOptions.limitMs ?? 0)
  const remainingMs = session.remainingMs ?? displayLimitMs
  const usedMs = Math.max(displayLimitMs - remainingMs, 0)
  const progressPct = displayLimitMs
    ? Math.min((usedMs / displayLimitMs) * 100, 100)
    : 0

  return {
    session,
    feed,
    transcriptEvents,
    transcriptLines,
    correctionsList,
    vocabularyList,
    translations,
    translationPreferences,
    setTranslationPreferences,
    coachStreamUrl,
    handleStreamComplete,
    handleStreamDelta,
    handleStreamSegment,
    handlePrimaryClick,
    statusLabel,
    isBusy,
    isActive,
    isLimitReached,
    isStartDisabled,
    usedMs,
    remainingMs,
    displayLimitMs,
    progressPct,
  }
}
