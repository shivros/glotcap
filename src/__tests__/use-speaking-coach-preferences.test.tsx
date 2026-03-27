import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeakingCoachPreferences } from '@/lib/use-speaking-coach-preferences'

const languagePreferenceState = vi.hoisted(() => ({
  value: {
    languageId: 'ru',
    setLanguageId: vi.fn(),
    isHydratingLanguagePreference: false,
  },
}))

vi.mock('@/lib/use-user-language-preference', () => ({
  LANGUAGE_PREFERENCE_STORAGE_KEY: 'glotcap-app-language',
  useUserLanguagePreference: () => languagePreferenceState.value,
}))

const createStore = (initial: Record<string, string> = {}) => {
  const values = new Map<string, string>(Object.entries(initial))
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
}

describe('useSpeakingCoachPreferences', () => {
  beforeEach(() => {
    languagePreferenceState.value = {
      languageId: 'ru',
      setLanguageId: vi.fn(),
      isHydratingLanguagePreference: false,
    }
  })

  it('delegates language state to useUserLanguagePreference', () => {
    const store = createStore()

    const { result } = renderHook(() =>
      useSpeakingCoachPreferences({
        store,
      }),
    )

    expect(result.current.languageId).toBe('ru')
    result.current.setLanguageId('ja')
    expect(languagePreferenceState.value.setLanguageId).toHaveBeenCalledWith(
      'ja',
    )
  })

  it('persists and validates conversation mode changes', async () => {
    const store = createStore({
      'glotcap-app-mode': 'coach',
    })

    const { result } = renderHook(() =>
      useSpeakingCoachPreferences({
        store,
      }),
    )

    act(() => {
      result.current.handleConversationModeChange('dual_stream')
    })

    await waitFor(() =>
      expect(store.setItem).toHaveBeenCalledWith(
        'glotcap-app-mode',
        'dual_stream',
      ),
    )

    store.setItem.mockClear()
    act(() => {
      result.current.handleConversationModeChange('unsupported')
    })

    await waitFor(() => expect(store.setItem).not.toHaveBeenCalled())
  })

  it('persists and removes device selections', async () => {
    const store = createStore()
    const { result } = renderHook(() => useSpeakingCoachPreferences({ store }))

    act(() => {
      result.current.setLearnerDeviceId('mic-1')
    })
    await waitFor(() =>
      expect(store.setItem).toHaveBeenCalledWith(
        'glotcap-app-learner-device',
        'mic-1',
      ),
    )

    act(() => {
      result.current.setLearnerDeviceId(null)
    })
    await waitFor(() =>
      expect(store.removeItem).toHaveBeenCalledWith(
        'glotcap-app-learner-device',
      ),
    )
  })

  it('persists teacher input source method changes', async () => {
    const store = createStore()
    const { result } = renderHook(() => useSpeakingCoachPreferences({ store }))

    expect(result.current.hasExplicitTeacherInputSourceMethod).toBe(false)

    act(() => {
      result.current.setTeacherInputSourceMethod('display')
    })

    await waitFor(() =>
      expect(store.setItem).toHaveBeenCalledWith(
        'glotcap-app-teacher-source-method',
        'display',
      ),
    )
    expect(result.current.hasExplicitTeacherInputSourceMethod).toBe(true)
  })

  it('persists translation preference payloads', async () => {
    const store = createStore()
    const { result } = renderHook(() => useSpeakingCoachPreferences({ store }))

    act(() => {
      result.current.saveTranslationPreferences({
        self: 'hover',
        counterpart: 'off',
      })
    })

    await waitFor(() =>
      expect(store.setItem).toHaveBeenCalledWith(
        'glotcap-app-translation-preferences',
        JSON.stringify({
          self: 'hover',
          counterpart: 'off',
        }),
      ),
    )
  })
})
