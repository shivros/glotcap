import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRefBackedSttContextStore } from 'ts-common/speech/stt'
import type {
  RuntimeSttConfig,
  SttClient,
  SttClientHandlers,
} from 'ts-common/speech/stt'
import type { Id } from '../../convex/_generated/dataModel'
import type { SttContext } from '@/lib/speaking-session-stt'
import type { SttConnectionCoordinatorDeps } from '@/lib/stt/stt-connection-coordinator'
import { createSttConnectionCoordinator } from '@/lib/stt/stt-connection-coordinator'
import { createDefaultSttDisconnectClassifier } from '@/lib/stt/default-disconnect-classifier'
import { createDefaultSttRecycleStrategy } from '@/lib/stt/default-recycle-strategy'

type MockClientRecord = {
  handlers: SttClientHandlers
  sentAudio: Array<ArrayBuffer>
  closeSpy: ReturnType<typeof vi.fn>
  setReady: (ready: boolean) => void
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
        handlers,
        sentAudio: [],
        closeSpy,
        setReady: (nextReady: boolean) => {
          ready = nextReady
        },
      }
      clients.push(record)
      return {
        sendAudio: (audio: ArrayBuffer) => {
          record.sentAudio.push(audio)
        },
        close: () => {
          closeSpy()
        },
        isReady: () => ready,
      }
    },
  )

  return { createSttClient, clients }
}

const createDeps = (overrides?: {
  createSttSession?: (args: {
    sessionId: Id<'speakingSessions'>
    sampleRate: number
    language?: string
    model?: string
  }) => Promise<RuntimeSttConfig>
  createSttClient?: (
    config: RuntimeSttConfig,
    handlers: SttClientHandlers,
  ) => SttClient
  getActiveSessionId?: () => Id<'speakingSessions'> | null
  isStopRequested?: () => boolean
  reconnectDelayMs?: number
  shouldRetry?: (args: { attempt: number; error?: unknown }) => boolean
  onError?: ReturnType<typeof vi.fn>
}) => {
  const sttContextRef: { current: SttContext } = {
    current: { config: null, close: null },
  }

  const onErrorSpy = overrides?.onError ?? vi.fn()
  const invokeOnErrorSpy = onErrorSpy as unknown as (
    err: unknown,
    details: { sttClose: SttContext['close'] },
  ) => void
  const onError: SttConnectionCoordinatorDeps['lifecycle']['onError'] = (
    err,
    details,
  ) => {
    invokeOnErrorSpy(err, details)
  }

  return {
    deps: {
      runtime: {
        createSttSession:
          overrides?.createSttSession ?? vi.fn(() => Promise.resolve(config)),
        createSttClient:
          overrides?.createSttClient ??
          vi.fn(() => {
            throw new Error('missing createSttClient override')
          }),
        reconnectStrategy: {
          shouldRetry: overrides?.shouldRetry ?? vi.fn(() => false),
          getDelayMs: vi.fn(() => overrides?.reconnectDelayMs ?? 10),
        },
        recycleStrategy: createDefaultSttRecycleStrategy(),
        disconnectClassifier: createDefaultSttDisconnectClassifier(),
      },
      state: {
        getActiveSessionId: overrides?.getActiveSessionId ?? (() => sessionId),
        isStopRequested: overrides?.isStopRequested ?? (() => false),
      },
      playback: {
        isPlaybackActive: () => false,
        haltPlayback: vi.fn(),
      },
      transcript: {
        onSpeechActivity: vi.fn(),
        onTranscript: vi.fn(),
        onTranscriptComplete: vi.fn(),
      },
      lifecycle: {
        onError,
        onReady: vi.fn(),
        onRecoveryStateChange: vi.fn(),
        onConnectionLifecycleEvent: vi.fn(),
      },
      contextStore: createRefBackedSttContextStore(sttContextRef),
    },
    onError: onErrorSpy,
    sttContextRef,
  }
}

describe('createSttConnectionCoordinator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores stale bootstrap completion after stop', async () => {
    const createSttSession = vi.fn(
      () =>
        new Promise<RuntimeSttConfig>((resolve) => {
          setTimeout(() => resolve(config), 20)
        }),
    )
    const { createSttClient } = createClientFactory()
    const { deps } = createDeps({
      createSttSession,
      createSttClient,
    })

    const coordinator = createSttConnectionCoordinator({
      getDeps: () => deps,
    })

    const startPromise = coordinator.startStt({
      sessionId,
      sampleRate: 16000,
    })
    coordinator.stopStt()
    await startPromise

    expect(createSttSession).toHaveBeenCalledTimes(1)
    expect(createSttClient).not.toHaveBeenCalled()
  })

  it('skips recycle reconnect when session is no longer active', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T00:00:00Z'))

    let activeSessionId: Id<'speakingSessions'> | null = sessionId
    const createSttSession = vi.fn(() =>
      Promise.resolve({
        ...config,
        expiresAt: Date.now() + 3000,
      }),
    )
    const { createSttClient, clients } = createClientFactory()
    const { deps } = createDeps({
      createSttSession,
      createSttClient,
      getActiveSessionId: () => activeSessionId,
      shouldRetry: vi.fn(() => false),
    })

    const coordinator = createSttConnectionCoordinator({
      getDeps: () => deps,
    })

    await coordinator.startStt({
      sessionId,
      sampleRate: 16000,
    })
    clients[0]?.setReady(true)
    clients[0]?.handlers.onStatus?.('ready')

    activeSessionId = null
    await vi.advanceTimersByTimeAsync(1000)
    await flushMicrotasks()

    expect(createSttSession).toHaveBeenCalledTimes(1)
  })

  it('retries when client onError is retryable', async () => {
    vi.useFakeTimers()

    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { createSttClient, clients } = createClientFactory()
    const { deps } = createDeps({
      createSttSession,
      createSttClient,
      reconnectDelayMs: 15,
      shouldRetry: vi.fn(() => true),
    })

    const coordinator = createSttConnectionCoordinator({
      getDeps: () => deps,
    })

    await coordinator.startStt({
      sessionId,
      sampleRate: 16000,
    })
    clients[0]?.setReady(true)
    clients[0]?.handlers.onStatus?.('ready')

    clients[0]?.handlers.onError?.(new Error('temporary transport error'))
    await vi.advanceTimersByTimeAsync(15)
    await flushMicrotasks()

    expect(createSttSession).toHaveBeenCalledTimes(2)
    expect(deps.lifecycle.onRecoveryStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'reconnecting',
        reason: 'error',
      }),
    )
  })

  it('fails once for duplicated disconnect callbacks', async () => {
    vi.useFakeTimers()

    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { createSttClient, clients } = createClientFactory()
    const onError = vi.fn()
    const { deps } = createDeps({
      createSttSession,
      createSttClient,
      shouldRetry: vi.fn(() => false),
      onError,
    })

    const coordinator = createSttConnectionCoordinator({
      getDeps: () => deps,
    })

    await coordinator.startStt({
      sessionId,
      sampleRate: 16000,
    })
    clients[0]?.setReady(true)
    clients[0]?.handlers.onStatus?.('ready')

    const closeInfo = { code: 1011, reason: 'server restart', wasClean: false }
    clients[0]?.handlers.onClose?.(closeInfo)
    clients[0]?.handlers.onClose?.(closeInfo)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(deps.lifecycle.onRecoveryStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
      }),
    )
  })

  it('drops queued audio when no active args and caps pending queue while reconnecting', async () => {
    vi.useFakeTimers()

    const createSttSession = vi.fn(() => Promise.resolve(config))
    const { createSttClient, clients } = createClientFactory()
    const { deps } = createDeps({
      createSttSession,
      createSttClient,
      reconnectDelayMs: 25,
      shouldRetry: vi.fn(() => true),
    })

    const coordinator = createSttConnectionCoordinator({
      getDeps: () => deps,
    })

    const droppedBeforeStart = new Uint8Array([7]).buffer
    coordinator.sendAudio(droppedBeforeStart)

    await coordinator.startStt({
      sessionId,
      sampleRate: 16000,
    })
    clients[0]?.setReady(true)
    clients[0]?.handlers.onStatus?.('ready')

    clients[0]?.handlers.onClose?.({
      code: 1011,
      reason: 'temporary close',
      wasClean: false,
    })

    for (let i = 0; i < 300; i += 1) {
      const payload = new Uint16Array([i]).buffer
      coordinator.sendAudio(payload)
    }

    await vi.advanceTimersByTimeAsync(25)
    await flushMicrotasks()
    clients[1]?.setReady(true)
    clients[1]?.handlers.onStatus?.('ready')

    const flushedValues = (clients[1]?.sentAudio ?? []).map(
      (payload) => new Uint16Array(payload)[0],
    )

    expect(flushedValues.length).toBe(256)
    expect(flushedValues[0]).toBe(44)
    expect(flushedValues.at(-1)).toBe(299)

    coordinator.stopStt()
    const droppedAfterStop = new Uint8Array([9]).buffer
    coordinator.sendAudio(droppedAfterStop)

    expect(clients[1]?.sentAudio.length).toBe(256)
  })
})
