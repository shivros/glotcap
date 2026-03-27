import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeakingCoachController } from '@/lib/use-speaking-coach-controller'

const controllerState = vi.hoisted(() => ({
  preferences: {
    conversationMode: 'coach',
    languageId: 'ru',
    learnerDeviceId: 'mic-1',
    teacherDeviceId: 'mic-2' as string | null,
    teacherInputSourceMethod: 'device',
    hasExplicitTeacherInputSourceMethod: true,
    initialTranslationPreferences: {
      self: 'off',
      counterpart: 'off',
    },
    saveTranslationPreferences: vi.fn(),
    setLanguageId: vi.fn(),
    setLearnerDeviceId: vi.fn(),
    setTeacherDeviceId: vi.fn(),
    setTeacherInputSourceMethod: vi.fn(),
    isHydratingLanguagePreference: false,
  },
  coachSession: {
    isStartDisabled: false,
    session: {
      micPermission: 'granted',
    },
    translationPreferences: {
      self: 'off',
      counterpart: 'off',
    },
    setTranslationPreferences: vi.fn(),
    transcriptEvents: [],
    correctionsList: [],
    vocabularyList: [],
    translations: [],
  },
  audioCatalog: {
    inputs: [
      {
        id: 'mic-1',
        label: 'Mic 1',
        isMonitor: false,
      },
    ],
    isSupported: true,
    permissionState: 'granted',
    errorMessage: null,
    requestPermission: vi.fn(async () => {}),
  },
}))

vi.mock('@/lib/use-speaking-coach-preferences', () => ({
  useSpeakingCoachPreferences: () => controllerState.preferences,
}))

vi.mock('@/lib/speaking-coach-session', () => ({
  useSpeakingCoachSession: () => controllerState.coachSession,
}))

vi.mock('@/lib/audio/use-audio-input-catalog', () => ({
  useAudioInputCatalog: () => controllerState.audioCatalog,
}))

vi.mock('@/lib/audio/browser-audio-capture-capabilities', () => ({
  detectBrowserAudioCaptureCapabilities: () => ({
    browserFamily: 'chromium',
    hasDisplayMedia: true,
    supportsDisplayAudioCapture: true,
    prefersDisplayAudioCapture: true,
  }),
}))

describe('useSpeakingCoachController', () => {
  beforeEach(() => {
    controllerState.preferences.isHydratingLanguagePreference = false
    controllerState.preferences.conversationMode = 'coach'
    controllerState.preferences.learnerDeviceId = 'mic-1'
    controllerState.preferences.teacherDeviceId = 'mic-2'
    controllerState.preferences.teacherInputSourceMethod = 'device'
    controllerState.preferences.hasExplicitTeacherInputSourceMethod = true
    controllerState.coachSession.isStartDisabled = false
    controllerState.preferences.setTeacherInputSourceMethod.mockClear()
  })

  it('disables session start while language preference is hydrating', () => {
    controllerState.preferences.isHydratingLanguagePreference = true

    const { result } = renderHook(() => useSpeakingCoachController())

    expect(result.current.isSessionStartDisabled).toBe(true)
  })

  it('allows session start when hydration is complete and prerequisites are met', () => {
    controllerState.preferences.isHydratingLanguagePreference = false
    controllerState.coachSession.isStartDisabled = false

    const { result } = renderHook(() => useSpeakingCoachController())

    expect(result.current.isSessionStartDisabled).toBe(false)
  })

  it('does not require teacher device when display method is selected', () => {
    controllerState.preferences.conversationMode = 'dual_stream'
    controllerState.preferences.teacherInputSourceMethod = 'display'
    controllerState.preferences.teacherDeviceId = null

    const { result } = renderHook(() => useSpeakingCoachController())

    expect(result.current.dualModeNeedsTeacherSource).toBe(false)
    expect(result.current.isSessionStartDisabled).toBe(false)
  })

  it('defaults to display capture when no stored method exists and browser supports it', () => {
    controllerState.preferences.conversationMode = 'dual_stream'
    controllerState.preferences.hasExplicitTeacherInputSourceMethod = false
    controllerState.preferences.teacherInputSourceMethod = 'device'

    renderHook(() => useSpeakingCoachController())

    expect(
      controllerState.preferences.setTeacherInputSourceMethod,
    ).toHaveBeenCalledWith('display')
  })
})
