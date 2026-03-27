import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import type { UsageRetryPolicy } from '@/lib/usage/usage-retry-policy'
import { useUsageTracker } from '@/lib/speaking-session-usage'

const sessionId = 'session_usage' as Id<'speakingSessions'>

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const drainAsyncWork = async () => {
  await flushMicrotasks()
  await vi.runOnlyPendingTimersAsync()
  await flushMicrotasks()
}

describe('useUsageTracker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries transient ingest failures before succeeding', async () => {
    vi.useFakeTimers()
    const ingestAudioChunk = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          '[CONVEX A(speaking:ingestAudioChunk)] Connection lost while action was in flight',
        ),
      )
      .mockResolvedValueOnce({
        usageMs: 1200,
        limitMs: 3600000,
        status: 'active',
      })
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn()

    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        onUsageUpdate,
        onLimitReached,
        onError,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 1200)
    })

    await act(async () => {
      await drainAsyncWork()
    })

    expect(ingestAudioChunk).toHaveBeenCalledTimes(2)
    expect(onUsageUpdate).toHaveBeenCalledWith(1200, 3600000)
    expect(onError).not.toHaveBeenCalled()
  })

  it('surfaces non-transient ingest failures immediately', async () => {
    const ingestAudioChunk = vi
      .fn()
      .mockRejectedValueOnce(new Error('Permission denied'))
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn()

    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        onUsageUpdate,
        onLimitReached,
        onError,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 500)
    })

    await act(async () => {
      await flushMicrotasks()
    })

    expect(onUsageUpdate).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('supports custom retry policy without changing tracker logic', async () => {
    vi.useFakeTimers()
    const ingestAudioChunk = vi
      .fn()
      .mockRejectedValueOnce(new Error('Not transient by default classifier'))
      .mockResolvedValueOnce({
        usageMs: 500,
        limitMs: 3600000,
        status: 'active',
      })
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn()
    const retryPolicy: UsageRetryPolicy = {
      shouldRetry: ({ attempt }) => attempt < 2,
      getDelayMs: () => 25,
    }

    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        onUsageUpdate,
        onLimitReached,
        onError,
        retryPolicy,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 500)
    })

    await act(async () => {
      await drainAsyncWork()
    })

    expect(ingestAudioChunk).toHaveBeenCalledTimes(2)
    expect(onUsageUpdate).toHaveBeenCalledWith(500, 3600000)
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onLimitReached when usage result reaches limit', async () => {
    const ingestAudioChunk = vi.fn().mockResolvedValueOnce({
      usageMs: 1000,
      limitMs: 1000,
      status: 'limit_reached',
    })
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        onUsageUpdate,
        onLimitReached,
        onError,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 1000)
    })

    await act(async () => {
      await flushMicrotasks()
    })

    expect(onUsageUpdate).toHaveBeenCalledWith(1000, 1000)
    expect(onLimitReached).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('clears pending usage on reset and skips zero-sized chunks', async () => {
    const ingestAudioChunk = vi.fn().mockResolvedValue({
      usageMs: 100,
      limitMs: 1000,
      status: 'active',
    })
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn()

    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        onUsageUpdate,
        onLimitReached,
        onError,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 0)
      result.current.reset()
      result.current.queueUsage(sessionId, 120)
    })

    await act(async () => {
      await flushMicrotasks()
    })

    expect(ingestAudioChunk).toHaveBeenCalledTimes(1)
    expect(ingestAudioChunk).toHaveBeenCalledWith({
      sessionId,
      chunkMs: 120,
    })
  })

  it('aborts retry when stop is requested or session changes mid-retry', async () => {
    vi.useFakeTimers()
    const ingestAudioChunk = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          '[CONVEX A(speaking:ingestAudioChunk)] Connection lost while action was in flight',
        ),
      )
      .mockResolvedValue({
        usageMs: 200,
        limitMs: 1000,
        status: 'active',
      })
    const onUsageUpdate = vi.fn()
    const onError = vi.fn()
    const onLimitReached = vi.fn()

    let stopped = false
    let activeSessionId: Id<'speakingSessions'> | null = sessionId
    const { result } = renderHook(() =>
      useUsageTracker({
        ingestAudioChunk,
        getActiveSessionId: () => activeSessionId,
        isStopRequested: () => stopped,
        onUsageUpdate,
        onLimitReached,
        onError,
      }),
    )

    act(() => {
      result.current.queueUsage(sessionId, 200)
    })

    stopped = true
    activeSessionId = null

    await act(async () => {
      await drainAsyncWork()
    })

    expect(ingestAudioChunk).toHaveBeenCalledTimes(1)
    expect(onUsageUpdate).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
