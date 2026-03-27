import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  RuntimeSttConfig,
  SttClient,
  SttClientHandlers,
  SttDisconnectClassifier,
  SttReconnectStrategy,
  SttRecycleStrategy,
  TranscriptEvent,
} from 'ts-common/speech/stt'
import type { Id } from '../../convex/_generated/dataModel'
import type { SttReconnectPolicy } from '@/lib/stt-reconnect-policy'
import type { SttContext } from '@/lib/speaking-session-stt'
import type { SttStrategyFactory } from '@/lib/speaking-session-stt-strategy-factory'
import { useSttPipeline } from '@/lib/speaking-session-stt'

type MockClientRecord = {
  close: () => void
  closeSpy: ReturnType<typeof vi.fn>
  handlers: SttClientHandlers
  sentAudio: Array<ArrayBuffer>
  setReady: (ready: boolean) => void
}

const reconnectPolicy: SttReconnectPolicy = {
  maxAttempts: 2,
  baseDelayMs: 10,
  maxDelayMs: 10,
  jitterRatio: 0,
}

const sessionId = 'session_test' as Id<'speakingSessions'>
const config: RuntimeSttConfig = {
  provider: 'soniox',
  url: 'wss://stt.example.test',
  config: {
    api_key: 'temporary-key',
    model: 'stt-rt-preview-v2',
    audio_format: 'pcm_s16le',
    sample_rate: 16000,
  },
  expiresAt: null,
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createClientFactory = () => {
  const clients: Array<MockClientRecord> = []
  const createSttClient = vi.fn(
    (_config: RuntimeSttConfig, handlers: SttClientHandlers): SttClient => {
      let ready = false
      const closeSpy = vi.fn()
      const record: MockClientRecord = {
        close: () => {
          closeSpy()
        },
        closeSpy,
        handlers,
        sentAudio: [],
        setReady: (value: boolean) => {
          ready = value
        },
      }
      clients.push(record)
      return {
        sendAudio: (audio: ArrayBuffer) => {
          record.sentAudio.push(audio)
        },
        close: record.close,
        isReady: () => ready,
      }
    },
  )

  return { clients, createSttClient }
}

describe('useSttPipeline', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconnects after unexpected close and flushes queued audio', async () => {
    vi.useFakeTimers()
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { clients, createSttClient } = createClientFactory()
    const onError = vi.fn()
    const onReady = vi.fn()
    const onRecoveryStateChange = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(
          (_args: { sessionId: Id<'speakingSessions'>; text: string }) => {},
        ),
        onTranscriptComplete: vi.fn(),
        onError,
        onReady,
        onRecoveryStateChange,
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    expect(createSttSession).toHaveBeenCalledTimes(1)
    expect(createSttClient).toHaveBeenCalledTimes(1)

    act(() => {
      clients[0]?.setReady(true)
      clients[0]?.handlers.onStatus?.('ready')
    })
    expect(onReady).toHaveBeenCalledTimes(1)

    const initialPayload = new ArrayBuffer(2)
    act(() => {
      result.current.sendAudio(initialPayload)
    })
    expect(clients[0]?.sentAudio).toEqual([initialPayload])

    act(() => {
      clients[0]?.handlers.onClose?.({
        code: 1011,
        reason: 'server restart',
        wasClean: false,
      })
    })

    expect(onRecoveryStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'reconnecting',
        reason: 'close',
        attempt: 1,
        delayMs: 10,
      }),
    )

    const queuedPayloadA = new ArrayBuffer(3)
    const queuedPayloadB = new ArrayBuffer(4)
    act(() => {
      result.current.sendAudio(queuedPayloadA)
      result.current.sendAudio(queuedPayloadB)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(2)
    expect(createSttClient).toHaveBeenCalledTimes(2)
    expect(clients[1]?.sentAudio).toEqual([])

    act(() => {
      clients[1]?.setReady(true)
      clients[1]?.handlers.onStatus?.('ready')
    })

    expect(onReady).toHaveBeenCalledTimes(2)
    expect(clients[1]?.sentAudio).toEqual([queuedPayloadA, queuedPayloadB])
    expect(onRecoveryStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'stable',
        reason: 'ready',
        attempt: 0,
      }),
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('emits failed state and surfaces non-retryable bootstrap errors', async () => {
    vi.useFakeTimers()
    const bootstrapError = Object.assign(new Error('missing stt config'), {
      code: 'STT_CONFIG_MISSING',
    })
    const createSttSession = vi.fn(() => Promise.reject(bootstrapError))
    const { createSttClient } = createClientFactory()
    const onError = vi.fn()
    const onRecoveryStateChange = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(
          (_args: { sessionId: Id<'speakingSessions'>; text: string }) => {},
        ),
        onTranscriptComplete: vi.fn(),
        onError,
        onReady: vi.fn(),
        onRecoveryStateChange,
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(1)
    expect(createSttClient).not.toHaveBeenCalled()
    expect(onRecoveryStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        reason: 'bootstrap',
        attempt: 1,
      }),
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(bootstrapError, { sttClose: null })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
      await flushMicrotasks()
    })
    expect(createSttSession).toHaveBeenCalledTimes(1)
  })

  it('forwards only transcript events for the active session', async () => {
    const { clients, createSttClient } = createClientFactory()
    const onTranscript = vi.fn()
    const onSpeechActivity = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const transcriptEvent: TranscriptEvent = {
      text: ' hello ',
      isFinal: true,
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity,
        onTranscript,
        onTranscriptComplete: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    act(() => {
      clients[0]?.handlers.onTranscript(transcriptEvent)
    })

    expect(onSpeechActivity).toHaveBeenCalledWith({
      sessionId,
      text: 'hello',
    })
    expect(onTranscript).toHaveBeenCalledWith({
      sessionId,
      text: 'hello',
    })
  })

  it('recycles the STT connection before token expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-26T00:00:00Z'))

    const createSttSession = vi
      .fn()
      .mockResolvedValueOnce({
        ...config,
        expiresAt: Date.now() + 3000,
      })
      .mockResolvedValueOnce({
        ...config,
        expiresAt: Date.now() + 120000,
      })
    const { clients, createSttClient } = createClientFactory()
    const onConnectionLifecycleEvent = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
        onConnectionLifecycleEvent,
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
      await flushMicrotasks()
    })

    expect(createSttClient).toHaveBeenCalledTimes(1)
    expect(onConnectionLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'recycle_scheduled',
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
      await flushMicrotasks()
    })

    expect(createSttClient).toHaveBeenCalledTimes(2)
    expect(onConnectionLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'recycle_triggered',
      }),
    )

    act(() => {
      clients[1]?.setReady(true)
      clients[1]?.handlers.onStatus?.('ready')
    })
  })

  it('uses default recycle window when expiry is not provided', async () => {
    vi.useFakeTimers()
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { createSttClient } = createClientFactory()
    const onConnectionLifecycleEvent = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
        onConnectionLifecycleEvent,
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
      await flushMicrotasks()
    })

    expect(onConnectionLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'recycle_scheduled',
        delayMs: 240000,
        ttlMs: null,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(240000)
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(2)
    expect(onConnectionLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'recycle_triggered',
      }),
    )
  })

  it('stops cleanly without scheduling reconnects on explicit close', async () => {
    vi.useFakeTimers()
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { clients, createSttClient } = createClientFactory()
    const onError = vi.fn()
    const onRecoveryStateChange = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError,
        onReady: vi.fn(),
        onRecoveryStateChange,
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    expect(result.current.isReady()).toBe(false)
    act(() => {
      clients[0]?.setReady(true)
      clients[0]?.handlers.onStatus?.('ready')
    })
    expect(result.current.isReady()).toBe(true)

    act(() => {
      result.current.stopStt()
    })

    expect(clients[0]?.closeSpy).toHaveBeenCalledTimes(1)
    expect(sttContextRef.current).toEqual({ config: null, close: null })
    expect(onRecoveryStateChange).not.toHaveBeenCalled()

    act(() => {
      clients[0]?.handlers.onClose?.({
        code: 1000,
        reason: 'client-closed',
        wasClean: true,
      })
    })

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignores close callbacks from recycled connections', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-26T00:00:00Z'))

    const createSttSession = vi
      .fn()
      .mockResolvedValueOnce({
        ...config,
        expiresAt: Date.now() + 3000,
      })
      .mockResolvedValueOnce({
        ...config,
        expiresAt: Date.now() + 120000,
      })

    const createSttClient = vi.fn(
      (_config: RuntimeSttConfig, handlers: SttClientHandlers): SttClient => {
        return {
          sendAudio: vi.fn(),
          close: () => {
            handlers.onClose?.({
              code: 1000,
              reason: 'client-rotated',
              wasClean: true,
            })
          },
          isReady: () => true,
        }
      },
    )

    const onRecoveryStateChange = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
        onRecoveryStateChange,
        onConnectionLifecycleEvent: vi.fn(),
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
      await flushMicrotasks()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(2)
    expect(onRecoveryStateChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'reconnecting',
        reason: 'close',
      }),
    )
  })

  it('halts playback for active or non-final transcripts and skips empty finals', async () => {
    const { clients, createSttClient } = createClientFactory()
    const onTranscript = vi.fn()
    const onTranscriptComplete = vi.fn()
    const onSpeechActivity = vi.fn()
    const haltPlayback = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }
    const createSttSession = vi.fn(() => Promise.resolve(config))

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => true,
        haltPlayback,
        onSpeechActivity,
        onTranscript,
        onTranscriptComplete,
        onError: vi.fn(),
        onReady: vi.fn(),
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    act(() => {
      clients[0]?.handlers.onTranscript({
        text: ' hello ',
        isFinal: true,
      })
      clients[0]?.handlers.onTranscript({
        text: ' partial ',
        isFinal: false,
      })
      clients[0]?.handlers.onTranscript({
        text: '  ',
        isFinal: true,
      })
    })

    expect(onSpeechActivity).toHaveBeenCalledTimes(2)
    expect(haltPlayback).toHaveBeenCalledTimes(3)
    expect(onTranscript).not.toHaveBeenCalled()
    expect(onTranscriptComplete).not.toHaveBeenCalled()
  })

  it('drops reconnect attempts when session becomes stale', async () => {
    vi.useFakeTimers()
    let activeSession: Id<'speakingSessions'> | null = sessionId
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { clients, createSttClient } = createClientFactory()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        getActiveSessionId: () => activeSession,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    act(() => {
      clients[0]?.handlers.onClose?.({
        code: 1011,
        reason: 'stale',
        wasClean: false,
      })
    })

    activeSession = null

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
      await flushMicrotasks()
    })

    expect(createSttSession).toHaveBeenCalledTimes(1)
  })

  it('uses injected runtime strategy factory', async () => {
    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { clients, createSttClient } = createClientFactory()
    const onError = vi.fn()
    const sttContextRef: { current: SttContext } = {
      current: { config: null, close: null },
    }

    const reconnectStrategy: SttReconnectStrategy = {
      shouldRetry: vi.fn(
        ({
          attempt: _attempt,
          error: _error,
        }: {
          attempt: number
          error?: unknown
        }) => false,
      ),
      getDelayMs: vi.fn((attempt: number) => attempt * 13),
    }
    const recycleStrategy: SttRecycleStrategy = {
      getSchedule: vi.fn(({ config: _config, now: _now }) => ({
        delayMs: 240000,
        ttlMs: null,
      })),
    }
    const disconnectClassifier: SttDisconnectClassifier = {
      classify: vi.fn(({ attempt, error }) => {
        const retryable = reconnectStrategy.shouldRetry({
          attempt,
          error,
        })
        return retryable ? 'retry' : 'fail'
      }),
    }
    const strategyFactorySpy = vi.fn(
      (_args: Parameters<SttStrategyFactory>[0]) => ({
        reconnectStrategy,
        recycleStrategy,
        disconnectClassifier,
      }),
    )

    const { result } = renderHook(() =>
      useSttPipeline({
        createSttSession,
        createSttClient,
        reconnectPolicy,
        strategyFactory: strategyFactorySpy,
        getActiveSessionId: () => sessionId,
        isStopRequested: () => false,
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
        onError,
        onReady: vi.fn(),
        sttContextRef,
      }),
    )

    await act(async () => {
      await result.current.startStt({
        sessionId,
        sampleRate: 16000,
      })
    })

    act(() => {
      clients[0]?.setReady(true)
      clients[0]?.handlers.onStatus?.('ready')
      clients[0]?.handlers.onClose?.({
        code: 1011,
        reason: 'server restart',
        wasClean: false,
      })
    })

    expect(strategyFactorySpy).toHaveBeenCalledWith({
      reconnectPolicy,
      random: undefined,
    })
    expect(recycleStrategy.getSchedule).toHaveBeenCalledTimes(1)
    expect(disconnectClassifier.classify).toHaveBeenCalledTimes(1)
    expect(reconnectStrategy.shouldRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
      }),
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(createSttSession).toHaveBeenCalledTimes(1)
  })
})
