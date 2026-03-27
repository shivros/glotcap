import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConvexLanguagePreferencePort } from '@/lib/use-convex-language-preference-port'

const convexState = vi.hoisted(() => ({
  remotePreference: undefined as
    | { languageId: string | null; isAuthenticated: boolean }
    | undefined,
  persistMutation: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useQuery: () => convexState.remotePreference,
  useMutation: () => convexState.persistMutation,
}))

describe('useConvexLanguagePreferencePort', () => {
  beforeEach(() => {
    convexState.remotePreference = undefined
    convexState.persistMutation.mockReset()
  })

  it('exposes remote preference from Convex query', () => {
    convexState.remotePreference = {
      languageId: 'ru',
      isAuthenticated: true,
    }
    convexState.persistMutation.mockResolvedValue({
      languageId: 'ru',
      updatedAt: 10,
    })

    const { result } = renderHook(() => useConvexLanguagePreferencePort())

    expect(result.current.remotePreference).toEqual({
      languageId: 'ru',
      isAuthenticated: true,
    })
  })

  it('persists language preference through Convex mutation', async () => {
    convexState.persistMutation.mockResolvedValue({
      languageId: 'ja',
      updatedAt: 42,
    })

    const { result } = renderHook(() => useConvexLanguagePreferencePort())
    const response = await result.current.persistLanguagePreference('ja')

    expect(convexState.persistMutation).toHaveBeenCalledWith({
      languageId: 'ja',
    })
    expect(response).toEqual({
      languageId: 'ja',
      updatedAt: 42,
    })
  })

  it('propagates persistence failures to the caller', async () => {
    const failure = new Error('persist failed')
    convexState.persistMutation.mockRejectedValue(failure)

    const { result } = renderHook(() => useConvexLanguagePreferencePort())

    await expect(
      result.current.persistLanguagePreference('ru'),
    ).rejects.toThrow('persist failed')
  })
})
