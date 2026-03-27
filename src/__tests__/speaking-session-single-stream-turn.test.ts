import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeakingSessionSingleStreamTurnController } from '@/lib/speaking-session-single-stream-turn'

describe('createSpeakingSessionSingleStreamTurnController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes transcript-complete turns through the controller callback', async () => {
    const onTurnReady = vi.fn(async () => {})
    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      interruptPlayback: vi.fn(),
    })

    controller.setCallbacks({
      onTurnReady,
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onError: vi.fn(),
    })

    expect(controller.start()).toBe(true)
    controller.onFinalTranscript('Hola')
    controller.onFinalTranscript('mundo')
    controller.onTranscriptComplete()

    await vi.advanceTimersByTimeAsync(300)
    expect(onTurnReady).toHaveBeenCalledWith({
      identity: 'session-1',
      text: 'Hola mundo',
    })
  })

  it('cancels pending replies and interrupts playback for accepted interruptions', () => {
    const interruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()
    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => true,
      hasPendingReply: () => true,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => 9_900,
      interruptPlayback,
    })

    controller.setCallbacks({
      onTurnReady: async () => {},
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply,
      onError: vi.fn(),
    })

    controller.start()
    controller.onSpeechActivity('learner starts talking')

    expect(interruptPlayback).toHaveBeenCalledTimes(1)
    expect(onCancelPendingReply).toHaveBeenCalledTimes(1)
  })

  it('delegates outside-hold-window behavior to callback', () => {
    const interruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()
    const onOutsideHoldWindow = vi.fn()

    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      now: () => 10_000,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => 9_700,
      interruptPlayback,
    })

    controller.setCallbacks({
      onTurnReady: async () => {},
      onOutsideHoldWindow,
      onCancelPendingReply,
      onError: vi.fn(),
    })

    controller.start()
    controller.onSpeechActivity('new thought')

    expect(onOutsideHoldWindow).toHaveBeenCalledTimes(1)
    expect(interruptPlayback).not.toHaveBeenCalled()
    expect(onCancelPendingReply).not.toHaveBeenCalled()
  })

  it('forwards turn processing errors to the configured error callback', async () => {
    const onError = vi.fn()
    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      interruptPlayback: vi.fn(),
    })

    controller.setCallbacks({
      onTurnReady: () => Promise.reject(new Error('turn failure')),
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onError,
    })

    controller.start()
    controller.onFinalTranscript('Hola')
    controller.onTranscriptComplete()
    await vi.advanceTimersByTimeAsync(300)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        identity: 'session-1',
        text: 'Hola',
      }),
    )
  })

  it('exposes cancel and dispose wrappers', () => {
    const onTurnReady = vi.fn(async () => {})
    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      interruptPlayback: vi.fn(),
    })

    controller.setCallbacks({
      onTurnReady,
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onError: vi.fn(),
    })

    controller.start()
    controller.onFinalTranscript('Hola')
    controller.cancel('manual')
    controller.dispose()
    controller.dispose()

    expect(onTurnReady).not.toHaveBeenCalled()
  })
})
