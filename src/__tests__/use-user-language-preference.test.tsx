import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanguageId } from '../../shared/language-contract'
import type { KeyValueStore } from '@/lib/key-value-store'
import type {
  LanguagePreferencePort,
  RemoteLanguagePreference,
} from '@/lib/language-preference-port'
import { useUserLanguagePreferenceWithPort } from '@/lib/use-user-language-preference'

const createMemoryStore = (
  initial: Record<string, string> = {},
): KeyValueStore => {
  const values = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

const createPort = ({
  remotePreference,
  persistLanguagePreference,
}: {
  remotePreference: RemoteLanguagePreference
  persistLanguagePreference: ReturnType<typeof vi.fn>
}): LanguagePreferencePort => ({
  remotePreference,
  persistLanguagePreference:
    persistLanguagePreference as LanguagePreferencePort['persistLanguagePreference'],
})

describe('useUserLanguagePreference', () => {
  const persistLanguagePreference =
    vi.fn<
      (
        languageId: LanguageId,
      ) => Promise<{ languageId: LanguageId; updatedAt: number }>
    >()

  beforeEach(() => {
    persistLanguagePreference.mockReset()
    persistLanguagePreference.mockResolvedValue({
      languageId: 'fr' as LanguageId,
      updatedAt: 1,
    })
  })

  it('hydrates from server preference when available', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'fr' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: 'ru', isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )

    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )
    expect(result.current.languageId).toBe('ru')
    expect(persistLanguagePreference).not.toHaveBeenCalled()
  })

  it('promotes local selection to server when server preference is missing', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: null, isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )

    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )
    expect(result.current.languageId).toBe('ru')
    expect(persistLanguagePreference).toHaveBeenCalledWith('ru')
  })

  it('persists explicit user updates after hydration', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: 'ru', isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )
    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )

    act(() => {
      result.current.setLanguageId('ja')
    })

    expect(result.current.languageId).toBe('ja')
    await waitFor(() =>
      expect(persistLanguagePreference).toHaveBeenCalledWith('ja'),
    )
  })

  it('ignores unsupported languages', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: 'ru', isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )
    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )

    act(() => {
      result.current.setLanguageId('xx')
    })

    expect(result.current.languageId).toBe('ru')
    expect(persistLanguagePreference).not.toHaveBeenCalled()
  })

  it('does not persist when unauthenticated', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: null, isAuthenticated: false },
          persistLanguagePreference,
        }),
      }),
    )

    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )
    expect(result.current.languageId).toBe('ru')
    expect(persistLanguagePreference).not.toHaveBeenCalled()
  })

  it('keeps hydration pending while remote preference is unresolved', () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: undefined,
          persistLanguagePreference,
        }),
      }),
    )

    expect(result.current.isHydratingLanguagePreference).toBe(true)
    expect(persistLanguagePreference).not.toHaveBeenCalled()
  })

  it('does not persist user changes before hydration completes', () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: undefined,
          persistLanguagePreference,
        }),
      }),
    )

    act(() => {
      result.current.setLanguageId('ja')
    })

    expect(result.current.languageId).toBe('ja')
    expect(result.current.isHydratingLanguagePreference).toBe(true)
    expect(persistLanguagePreference).not.toHaveBeenCalled()
  })

  it('logs and swallows persistence errors', async () => {
    const store = createMemoryStore({ 'glotcap-app-language': 'ru' })
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    persistLanguagePreference.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: null, isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )

    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled())
    consoleErrorSpy.mockRestore()
  })

  it('ignores storage write errors', async () => {
    const store: KeyValueStore = {
      getItem: () => 'ru',
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {},
    }

    const { result } = renderHook(() =>
      useUserLanguagePreferenceWithPort({
        store,
        defaultLanguageId: 'fr',
        port: createPort({
          remotePreference: { languageId: 'ru', isAuthenticated: true },
          persistLanguagePreference,
        }),
      }),
    )

    await waitFor(() =>
      expect(result.current.isHydratingLanguagePreference).toBe(false),
    )

    act(() => {
      result.current.setLanguageId('ja')
    })
    expect(result.current.languageId).toBe('ja')
  })
})
