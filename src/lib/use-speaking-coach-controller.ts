import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AudioInputOption } from '@/lib/audio/audio-device-port'
import type {
  TranslationMode,
  TranslationRole,
} from '@/lib/translation-preferences'
import { detectBrowserAudioCaptureCapabilities } from '@/lib/audio/browser-audio-capture-capabilities'
import { navigatorAudioDevicePort } from '@/lib/audio/navigator-audio-device-port'
import { useAudioInputCatalog } from '@/lib/audio/use-audio-input-catalog'
import {
  CONVERSATION_MODE_ITEMS,
  getConversationModeConfig,
} from '@/lib/speaking-coach-mode-config'
import { languageOptions } from '@/lib/speaking-coach-languages'
import { useSpeakingCoachSession } from '@/lib/speaking-coach-session'
import { useFollowScroll } from '@/lib/use-follow-scroll'
import { useSpeakingCoachPreferences } from '@/lib/use-speaking-coach-preferences'

const DEFAULT_TTS_OUTPUT_FORMAT = 'mp3_22050_32'
const DEFAULT_TTS_LATENCY_HINT = 3

const liveCorrectionsFallback = [
  {
    type: 'good' as const,
    title: 'Live feedback',
    detail: 'Corrections will appear as you speak.',
  },
]

const getLearnerDefaultDevice = (devices: Array<AudioInputOption>) => {
  if (devices.length === 0) {
    return null
  }
  return devices.find((device) => !device.isMonitor)?.id ?? devices[0].id
}

const getTeacherDefaultDevice = (
  devices: Array<AudioInputOption>,
  learnerDeviceId: string | null,
) =>
  devices.find((device) => device.isMonitor && device.id !== learnerDeviceId)
    ?.id ??
  devices.find((device) => device.id !== learnerDeviceId)?.id ??
  null

export type InsightsMode = 'corrections' | 'vocabulary' | 'both'

export const useSpeakingCoachController = () => {
  const preferences = useSpeakingCoachPreferences()
  const {
    conversationMode,
    languageId,
    learnerDeviceId,
    teacherDeviceId,
    teacherInputSourceMethod,
    hasExplicitTeacherInputSourceMethod,
    initialTranslationPreferences,
    saveTranslationPreferences,
    setLanguageId,
    setLearnerDeviceId,
    setTeacherDeviceId,
    setTeacherInputSourceMethod,
    isHydratingLanguagePreference,
  } = preferences
  const teacherSourceCapabilities = useMemo(
    () => detectBrowserAudioCaptureCapabilities(),
    [],
  )
  const canCaptureDisplayAudio =
    teacherSourceCapabilities.supportsDisplayAudioCapture

  useEffect(() => {
    if (hasExplicitTeacherInputSourceMethod) {
      return
    }
    if (!canCaptureDisplayAudio) {
      return
    }
    setTeacherInputSourceMethod('display')
  }, [
    canCaptureDisplayAudio,
    hasExplicitTeacherInputSourceMethod,
    setTeacherInputSourceMethod,
  ])

  useEffect(() => {
    if (teacherInputSourceMethod !== 'display') {
      return
    }
    if (canCaptureDisplayAudio) {
      return
    }
    setTeacherInputSourceMethod('device')
  }, [
    canCaptureDisplayAudio,
    setTeacherInputSourceMethod,
    teacherInputSourceMethod,
  ])
  const modeConfig = useMemo(
    () => getConversationModeConfig(conversationMode),
    [conversationMode],
  )
  const activeLanguage = useMemo(
    () =>
      languageOptions.find((option) => option.id === languageId) ??
      languageOptions[0],
    [languageId],
  )
  const fallbackTranscript = useMemo(
    () => [
      {
        speaker: modeConfig.fallbackTranscriptSpeaker,
        text: modeConfig.fallbackTranscriptText,
      },
    ],
    [modeConfig.fallbackTranscriptSpeaker, modeConfig.fallbackTranscriptText],
  )

  const coachSession = useSpeakingCoachSession({
    sessionOptions: {
      mode: 'standard',
      conversationMode,
      targetLanguage: activeLanguage.targetLanguage,
      sourceLanguage: 'English',
      learnerInputDeviceId: learnerDeviceId ?? undefined,
      teacherInputDeviceId: modeConfig.requiresTeacherSource
        ? (teacherDeviceId ?? undefined)
        : undefined,
      teacherInputSourceMethod: modeConfig.requiresTeacherSource
        ? teacherInputSourceMethod
        : undefined,
      sttLanguage: activeLanguage.sttLanguage,
      ttsLanguageCode: activeLanguage.ttsLanguageCode,
      ttsOutputFormat: DEFAULT_TTS_OUTPUT_FORMAT,
      ttsLatencyHint: DEFAULT_TTS_LATENCY_HINT,
    },
    translationTargetLanguage: 'English',
    initialTranslationPreferences,
    fallbackTranscript,
    fallbackCorrections: liveCorrectionsFallback,
    limitReachedLabel: 'Daily limit reached',
  })

  const audioCatalog = useAudioInputCatalog({
    port: navigatorAudioDevicePort,
    sessionMicPermission: coachSession.session.micPermission,
  })
  const audioInputDevices = audioCatalog.inputs
  const hasAudioInputs = audioInputDevices.length > 0

  useEffect(() => {
    if (audioInputDevices.length === 0) {
      setLearnerDeviceId(null)
      setTeacherDeviceId(null)
      return
    }

    setLearnerDeviceId((current) => {
      if (
        current &&
        audioInputDevices.some((device) => device.id === current)
      ) {
        return current
      }
      return getLearnerDefaultDevice(audioInputDevices)
    })

    setTeacherDeviceId((current) => {
      const nextLearner =
        learnerDeviceId ?? getLearnerDefaultDevice(audioInputDevices)
      if (
        current &&
        audioInputDevices.some((device) => device.id === current)
      ) {
        return current
      }
      return getTeacherDefaultDevice(audioInputDevices, nextLearner)
    })
  }, [
    audioInputDevices,
    learnerDeviceId,
    setLearnerDeviceId,
    setTeacherDeviceId,
  ])

  useEffect(() => {
    saveTranslationPreferences(coachSession.translationPreferences)
  }, [coachSession.translationPreferences, saveTranslationPreferences])

  const dualModeNeedsTeacherSource =
    modeConfig.requiresTeacherSource &&
    teacherInputSourceMethod === 'device' &&
    !teacherDeviceId
  const noDeviceSelected = !learnerDeviceId || dualModeNeedsTeacherSource
  const isSessionStartDisabled =
    coachSession.isStartDisabled ||
    noDeviceSelected ||
    isHydratingLanguagePreference

  const [insightsMode, setInsightsMode] = useState<InsightsMode>('both')
  const [isInsightsVisible, setInsightsVisible] = useState(true)
  const [isInsightsSheetOpen, setInsightsSheetOpen] = useState(false)
  const showCorrections = insightsMode !== 'vocabulary'
  const showVocabulary = insightsMode !== 'corrections'

  useEffect(() => {
    if (!isInsightsVisible) {
      setInsightsSheetOpen(false)
    }
  }, [isInsightsVisible])

  const { ref: transcriptScrollRef } = useFollowScroll({
    deps: [
      coachSession.transcriptEvents,
      coachSession.translationPreferences,
      coachSession.translations,
    ],
  })
  const { ref: correctionsScrollRef } = useFollowScroll({
    deps: [coachSession.correctionsList],
  })
  const { ref: vocabularyScrollRef } = useFollowScroll({
    deps: [coachSession.vocabularyList],
  })

  const handleLanguageChange = useCallback(
    (value: string | null) => {
      if (!value) {
        return
      }
      setLanguageId(value)
    },
    [setLanguageId],
  )

  const setTranslationMode = useCallback(
    (role: TranslationRole, mode: TranslationMode) => {
      coachSession.setTranslationPreferences((prev) => {
        if (prev[role] === mode) {
          return prev
        }
        return {
          ...prev,
          [role]: mode,
        }
      })
    },
    [coachSession],
  )

  return {
    preferences,
    modeConfig,
    conversationModeItems: CONVERSATION_MODE_ITEMS,
    activeLanguage,
    audioCatalog,
    audioInputDevices,
    hasAudioInputs,
    coachSession,
    dualModeNeedsTeacherSource,
    teacherSourceCapabilities,
    canCaptureDisplayAudio,
    isSessionStartDisabled,
    noDeviceSelected,
    isHydratingLanguagePreference,
    handleLanguageChange,
    setTranslationMode,
    transcriptScrollRef,
    correctionsScrollRef,
    vocabularyScrollRef,
    insightsMode,
    setInsightsMode,
    isInsightsVisible,
    setInsightsVisible,
    isInsightsSheetOpen,
    setInsightsSheetOpen,
    showCorrections,
    showVocabulary,
  }
}

export type SpeakingCoachControllerState = ReturnType<
  typeof useSpeakingCoachController
>
