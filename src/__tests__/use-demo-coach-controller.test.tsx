import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDemoCoachController } from '@/lib/use-demo-coach-controller'

const controllerState = vi.hoisted(() => ({
  preferences: {
    conversationMode: 'coach',
    languageId: 'fr',
    learnerDeviceId: 'mic-1' as string | null,
    teacherDeviceId: null as string | null,
    initialTranslationPreferences: {
      self: 'off',
      counterpart: 'off',
    },
    saveTranslationPreferences: vi.fn(),
    setLanguageId: vi.fn(),
    setLearnerDeviceId: vi.fn(),
    setTeacherDeviceId: vi.fn(),
    handleConversationModeChange: vi.fn(),
    setConversationMode: vi.fn(),
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
  capturedSessionOptions: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/use-speaking-coach-preferences', () => ({
  useSpeakingCoachPreferences: () => controllerState.preferences,
}))

vi.mock('@/lib/speaking-coach-session', () => ({
  useSpeakingCoachSession: (args: Record<string, unknown>) => {
    controllerState.capturedSessionOptions = args
    return controllerState.coachSession
  },
}))

vi.mock('@/lib/audio/use-audio-input-catalog', () => ({
  useAudioInputCatalog: () => controllerState.audioCatalog,
}))

describe('useDemoCoachController', () => {
  beforeEach(() => {
    controllerState.preferences.isHydratingLanguagePreference = false
    controllerState.preferences.learnerDeviceId = 'mic-1'
    controllerState.coachSession.isStartDisabled = false
    controllerState.capturedSessionOptions = null
  })

  it('passes mode "demo" to the session', () => {
    renderHook(() => useDemoCoachController())

    expect(controllerState.capturedSessionOptions).toBeTruthy()
    expect(
      (
        controllerState.capturedSessionOptions!.sessionOptions as Record<
          string,
          unknown
        >
      ).mode,
    ).toBe('demo')
  })

  it('uses coach conversation mode only', () => {
    renderHook(() => useDemoCoachController())

    expect(
      (
        controllerState.capturedSessionOptions!.sessionOptions as Record<
          string,
          unknown
        >
      ).conversationMode,
    ).toBe('coach')
  })

  it('sets limit reached label for demo', () => {
    renderHook(() => useDemoCoachController())

    expect(controllerState.capturedSessionOptions!.limitReachedLabel).toBe(
      'Demo limit reached',
    )
  })

  it('reports dualModeNeedsTeacherSource as false', () => {
    const { result } = renderHook(() => useDemoCoachController())

    expect(result.current.dualModeNeedsTeacherSource).toBe(false)
  })

  it('disables session start while language preference is hydrating', () => {
    controllerState.preferences.isHydratingLanguagePreference = true

    const { result } = renderHook(() => useDemoCoachController())

    expect(result.current.isSessionStartDisabled).toBe(true)
  })

  it('allows session start when prerequisites are met', () => {
    const { result } = renderHook(() => useDemoCoachController())

    expect(result.current.isSessionStartDisabled).toBe(false)
  })

  it('disables session start when no learner device is selected', () => {
    controllerState.preferences.learnerDeviceId = null

    const { result } = renderHook(() => useDemoCoachController())

    expect(result.current.isSessionStartDisabled).toBe(true)
  })
})
