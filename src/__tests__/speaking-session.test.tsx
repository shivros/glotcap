import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import {
  useSpeakingSession,
  useSpeakingSessionFeed,
} from '@/lib/speaking-session'

const requestCorrectionsSpy = vi.hoisted(() => vi.fn())
const requestVocabularySpy = vi.hoisted(() => vi.fn())
const sttPipelineArgs = vi.hoisted(() => [] as Array<Record<string, unknown>>)
const sessionLifecycleArgs = vi.hoisted(
  () => [] as Array<Record<string, unknown>>,
)
const sessionLifecycleControls = vi.hoisted(
  () =>
    [] as Array<{
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      reset: ReturnType<typeof vi.fn>
    }>,
)
const singleStreamControllerArgs = vi.hoisted(
  () => [] as Array<Record<string, unknown>>,
)
const useQuerySpy = vi.hoisted(() =>
  vi.fn((..._args: Array<unknown>) => undefined),
)
const singleStreamControllerSpies = vi.hoisted(() => {
  const start = vi.fn(() => true)
  const cancel = vi.fn()
  const dispose = vi.fn()
  const onSpeechActivity = vi.fn()
  const onFinalTranscript = vi.fn()
  const onTranscriptComplete = vi.fn()
  const setCallbacks = vi.fn()

  return {
    start,
    cancel,
    dispose,
    onSpeechActivity,
    onFinalTranscript,
    onTranscriptComplete,
    setCallbacks,
    reset() {
      start.mockClear()
      start.mockImplementation(() => true)
      cancel.mockReset()
      dispose.mockReset()
      onSpeechActivity.mockReset()
      onFinalTranscript.mockReset()
      onTranscriptComplete.mockReset()
      setCallbacks.mockReset()
    },
  }
})

vi.mock('convex/react', () => ({
  useAction: () => vi.fn(() => Promise.resolve({})),
  useMutation: () =>
    vi.fn((args: Record<string, unknown>) => {
      if ('text' in args && 'sessionId' in args) {
        return Promise.resolve({ eventId: 'event_flush' })
      }
      return Promise.resolve({})
    }),
  useQuery: (...args: Array<unknown>) => useQuerySpy(...args),
}))

vi.mock('ts-common/logging/latency-batcher', () => ({
  createLatencyTelemetryBatcher: () => ({
    emit: vi.fn(),
    dispose: vi.fn(),
  }),
}))

vi.mock('@/lib/speaking-session-audio-support', () => ({
  useAudioSupport: () => ({
    micPermission: 'granted',
    isSupported: true,
    detectAudioSupport: vi.fn(() => true),
    setMicPermission: vi.fn(),
    setSupportStatus: vi.fn(),
  }),
}))

vi.mock('@/lib/speaking-session-coach-playback', () => ({
  useCoachPlayback: () => ({
    initPlayback: vi.fn(),
    haltPlayback: vi.fn(),
    interruptPlayback: vi.fn(),
    resetPlayback: vi.fn(),
    isPlaying: vi.fn(() => false),
    speakCoachText: vi.fn(),
  }),
}))

vi.mock('@/lib/speaking-session-config', () => ({
  getCoachInterruptionHoldMs: () => 0,
  getCoachResponseGapMs: () => 0,
}))

vi.mock('@/lib/speaking-session-corrections', () => ({
  useCorrectionsPipeline: () => ({
    requestCorrections: requestCorrectionsSpy,
  }),
}))

vi.mock('@/lib/speaking-session-vocabulary', () => ({
  useVocabularyPipeline: () => ({
    requestVocabulary: requestVocabularySpy,
  }),
}))

vi.mock('@/lib/speaking-session-lifecycle', () => ({
  useSessionLifecycle: (params: {
    sessionIdRef: { current: Id<'speakingSessions'> | null }
    setStatus: (status: string) => void
    stopMedia: () => void
  }) => {
    const start = vi.fn(() => {
      sessionLifecycleArgs.push(params)
      params.sessionIdRef.current = 'session_test' as Id<'speakingSessions'>
      params.setStatus('active')
      return Promise.resolve()
    })
    const stop = vi.fn(() => {
      params.stopMedia()
      return Promise.resolve()
    })
    const reset = vi.fn(() => {})
    sessionLifecycleControls.push({ start, stop, reset })
    return {
      start,
      stop,
      reset,
    }
  },
}))

vi.mock('@/lib/speaking-session-turn-coordinator', () => ({
  useTurnCoordinator: () => ({
    getTurnId: vi.fn(() => 'turn_1'),
    markActive: vi.fn(),
    markFinalized: vi.fn(),
    invalidateTurn: vi.fn(() => 'turn_2'),
    advanceTurn: vi.fn(() => 'turn_2'),
    reset: vi.fn(),
    isFinalized: vi.fn(() => true),
  }),
}))

vi.mock('@/lib/speaking-session-usage', () => ({
  useUsageTracker: () => ({
    queueUsage: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/lib/speaking-session-stt', () => ({
  useSttPipeline: (args: Record<string, unknown>) => {
    sttPipelineArgs.push(args)
    return {
      startStt: vi.fn(async () => {}),
      stopStt: vi.fn(),
      sendAudio: vi.fn(),
      isReady: vi.fn(() => false),
    }
  },
}))

vi.mock('@/lib/speaking-session-single-stream-turn', () => ({
  createSpeakingSessionSingleStreamTurnController: (
    args: Record<string, unknown>,
  ) => {
    singleStreamControllerArgs.push(args)
    return {
      start: singleStreamControllerSpies.start,
      cancel: singleStreamControllerSpies.cancel,
      dispose: singleStreamControllerSpies.dispose,
      onSpeechActivity: singleStreamControllerSpies.onSpeechActivity,
      onFinalTranscript: singleStreamControllerSpies.onFinalTranscript,
      onTranscriptComplete: singleStreamControllerSpies.onTranscriptComplete,
      setCallbacks: singleStreamControllerSpies.setCallbacks,
    }
  },
}))

describe('useSpeakingSession learner insight wiring', () => {
  beforeEach(() => {
    requestCorrectionsSpy.mockReset()
    requestVocabularySpy.mockReset()
    useQuerySpy.mockReset()
    sttPipelineArgs.length = 0
    sessionLifecycleArgs.length = 0
    sessionLifecycleControls.length = 0
    singleStreamControllerArgs.length = 0
    singleStreamControllerSpies.reset()
  })

  it('dispatches both corrections and vocabulary on learner transcript flush', async () => {
    const { result } = renderHook(() =>
      useSpeakingSession({
        mode: 'standard',
        conversationMode: 'dual_stream',
        targetLanguage: 'Spanish',
        sourceLanguage: 'English',
      }),
    )

    await act(async () => {
      await result.current.start()
    })

    const learnerPipeline = sttPipelineArgs[0] as {
      onTranscript: (args: {
        sessionId: Id<'speakingSessions'>
        text: string
      }) => void
      onTranscriptComplete: () => void
    }

    act(() => {
      learnerPipeline.onTranscript({
        sessionId: 'session_test' as Id<'speakingSessions'>,
        text: 'Hola mundo',
      })
      learnerPipeline.onTranscriptComplete()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(requestCorrectionsSpy).toHaveBeenCalledTimes(1)
    expect(requestVocabularySpy).toHaveBeenCalledTimes(1)
    expect(requestCorrectionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_test',
        text: 'Hola mundo',
      }),
    )
    expect(requestVocabularySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_test',
        text: 'Hola mundo',
      }),
    )
  })

  it('routes single-stream STT events through the shared turn controller', async () => {
    const { result, unmount } = renderHook(() =>
      useSpeakingSession({
        mode: 'standard',
        conversationMode: 'coach',
        targetLanguage: 'Spanish',
        sourceLanguage: 'English',
      }),
    )

    await act(async () => {
      await result.current.start()
    })

    expect(singleStreamControllerArgs).toHaveLength(1)
    expect(singleStreamControllerArgs[0]).toEqual(
      expect.objectContaining({
        observer: expect.objectContaining({
          emit: expect.any(Function),
        }),
      }),
    )

    const learnerPipeline = sttPipelineArgs[0] as {
      onSpeechActivity: (args: {
        sessionId: Id<'speakingSessions'>
        text: string
      }) => void
      onTranscript: (args: {
        sessionId: Id<'speakingSessions'>
        text: string
      }) => void
      onTranscriptComplete: () => void
    }

    act(() => {
      learnerPipeline.onSpeechActivity({
        sessionId: 'session_test' as Id<'speakingSessions'>,
        text: 'Hola',
      })
      learnerPipeline.onTranscript({
        sessionId: 'session_test' as Id<'speakingSessions'>,
        text: 'mundo',
      })
      learnerPipeline.onTranscriptComplete()
    })

    await act(async () => {
      await result.current.stop()
    })

    unmount()

    expect(singleStreamControllerSpies.setCallbacks).toHaveBeenCalled()
    expect(singleStreamControllerSpies.onSpeechActivity).toHaveBeenCalledWith(
      'Hola',
    )
    expect(singleStreamControllerSpies.onFinalTranscript).toHaveBeenCalledWith(
      'mundo',
    )
    expect(singleStreamControllerSpies.onTranscriptComplete).toHaveBeenCalled()
    expect(singleStreamControllerSpies.cancel).toHaveBeenCalledWith(
      'stop_media',
    )
    expect(singleStreamControllerSpies.dispose).toHaveBeenCalled()
  })

  it('forwards reset and stop wrappers through lifecycle handlers', async () => {
    const { result } = renderHook(() =>
      useSpeakingSession({
        mode: 'standard',
        conversationMode: 'coach',
        targetLanguage: 'Spanish',
        sourceLanguage: 'English',
      }),
    )

    await act(async () => {
      await result.current.start()
    })

    act(() => {
      result.current.reset()
    })
    expect(
      sessionLifecycleControls.some(
        (control) => control.reset.mock.calls.length > 0,
      ),
    ).toBe(true)

    await act(async () => {
      await result.current.stop()
    })
    expect(
      sessionLifecycleControls.some(
        (control) => control.stop.mock.calls.length > 0,
      ),
    ).toBe(true)
  })

  it('returns early from resume when resume is unavailable', async () => {
    const { result } = renderHook(() =>
      useSpeakingSession({
        mode: 'standard',
        conversationMode: 'coach',
        targetLanguage: 'Spanish',
        sourceLanguage: 'English',
      }),
    )
    const lifecycle = sessionLifecycleControls.at(-1)
    expect(lifecycle).toBeTruthy()

    await act(async () => {
      await result.current.resume()
    })

    expect(lifecycle?.start).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    expect(result.current.canResume).toBe(false)
  })
})

describe('useSpeakingSessionFeed', () => {
  beforeEach(() => {
    useQuerySpy.mockReset()
  })

  it('uses skip query args when session id is null', () => {
    renderHook(() => useSpeakingSessionFeed(null))

    expect(useQuerySpy).toHaveBeenCalledWith(expect.anything(), 'skip')
  })

  it('uses default limit when not provided', () => {
    renderHook(() =>
      useSpeakingSessionFeed('session_1' as Id<'speakingSessions'>),
    )

    expect(useQuerySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: 'session_1',
        limit: 80,
      }),
    )
  })
})
