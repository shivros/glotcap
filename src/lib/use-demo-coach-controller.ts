import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AudioInputOption } from '@/lib/audio/audio-device-port'
import type {
  TranslationMode,
  TranslationRole,
} from '@/lib/translation-preferences'
import type { InsightsMode } from '@/lib/use-speaking-coach-controller'
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

export const useDemoCoachController = () => {
  const preferences = useSpeakingCoachPreferences()
  const {
    languageId,
    learnerDeviceId,
    initialTranslationPreferences,
    saveTranslationPreferences,
    setLanguageId,
    setLearnerDeviceId,
    isHydratingLanguagePreference,
  } = preferences

  const conversationMode = 'coach' as const
  const modeConfig = useMemo(
    () => getConversationModeConfig(conversationMode),
    [],
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
      mode: 'demo',
      conversationMode,
      targetLanguage: activeLanguage.targetLanguage,
      sourceLanguage: 'English',
      learnerInputDeviceId: learnerDeviceId ?? undefined,
      sttLanguage: activeLanguage.sttLanguage,
      ttsLanguageCode: activeLanguage.ttsLanguageCode,
      ttsOutputFormat: DEFAULT_TTS_OUTPUT_FORMAT,
      ttsLatencyHint: DEFAULT_TTS_LATENCY_HINT,
    },
    translationTargetLanguage: 'English',
    initialTranslationPreferences,
    fallbackTranscript,
    fallbackCorrections: liveCorrectionsFallback,
    limitReachedLabel: 'Demo limit reached',
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
  }, [audioInputDevices, setLearnerDeviceId])

  useEffect(() => {
    saveTranslationPreferences(coachSession.translationPreferences)
  }, [coachSession.translationPreferences, saveTranslationPreferences])

  const noDeviceSelected = !learnerDeviceId
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
    dualModeNeedsTeacherSource: false,
    teacherSourceCapabilities: {
      browserFamily: 'unknown' as const,
      hasDisplayMedia: false,
      supportsDisplayAudioCapture: false,
      prefersDisplayAudioCapture: false,
    },
    canCaptureDisplayAudio: false,
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
