import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSessionLifecycle } from '@/lib/speaking-session-lifecycle'

const baseParams = () => {
  const sessionIdRef = { current: 'session-1' as any }
  const stopInProgressRef = { current: false }

  return {
    options: {
      mode: 'standard' as const,
      targetLanguage: 'French',
    },
    status: 'active' as const,
    setStatus: vi.fn(),
    setMode: vi.fn(),
    setSessionId: vi.fn(),
    setUsageMs: vi.fn(),
    setLimitMs: vi.fn(),
    setError: vi.fn(),
    detectAudioSupport: vi.fn(() => true),
    setSupportStatus: vi.fn(),
    setMicPermission: vi.fn(),
    startSession: vi.fn(),
    endSession: vi.fn(() => Promise.resolve({ status: 'ended' })),
    stopMedia: vi.fn(),
    onSessionStart: vi.fn(),
    onFailure: vi.fn(),
    sessionIdRef,
    stopInProgressRef,
    setStream: vi.fn(),
  }
}

describe('useSessionLifecycle', () => {
  it.each([
    ['manual', 'manual'],
    ['error', 'error'],
    ['limit', 'limit_reached'],
  ] as const)(
    'maps stop(%s) to terminationReason %s',
    async (stopReason, terminationReason) => {
      const params = baseParams()
      const { result } = renderHook(() => useSessionLifecycle(params as any))

      await act(async () => {
        await result.current.stop(stopReason)
      })

      expect(params.endSession).toHaveBeenCalledWith({
        sessionId: 'session-1',
        terminationReason,
      })
      expect(params.stopMedia).toHaveBeenCalled()
    },
  )

  it('does not re-enter stop while a stop is already in progress', async () => {
    const params = baseParams()
    params.stopInProgressRef.current = true

    const { result } = renderHook(() => useSessionLifecycle(params as any))

    await act(async () => {
      await result.current.stop('manual')
    })

    expect(params.endSession).not.toHaveBeenCalled()
    expect(params.stopMedia).not.toHaveBeenCalled()
    expect(params.setStatus).not.toHaveBeenCalled()
  })
})
