import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeakingSessionSharedTurnOrchestrator } from '@/lib/speaking-session-shared-turn-orchestrator'

describe('createSpeakingSessionSharedTurnOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes buffered transcript through shared turn orchestration', async () => {
    const onTurnReady = vi.fn(async () => {})

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      onInterruptPlayback: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onTurnReady,
    })

    expect(orchestrator.start()).toBe(true)
    orchestrator.handleFinalTranscript('Hola')
    orchestrator.handleFinalTranscript('mundo')
    orchestrator.handleTranscriptComplete()

    await vi.advanceTimersByTimeAsync(299)
    expect(onTurnReady).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onTurnReady).toHaveBeenCalledWith({
      identity: 'session-1',
      text: 'Hola mundo',
    })
  })

  it('interrupts playback and pending replies when interruption is accepted', () => {
    const onInterruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => true,
      hasPendingReply: () => true,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => Date.now(),
      onInterruptPlayback,
      onCancelPendingReply,
      onTurnReady: async () => {},
    })

    orchestrator.start()
    orchestrator.handleSpeechActivity('Learner starts talking')

    expect(onInterruptPlayback).toHaveBeenCalledTimes(1)
    expect(onCancelPendingReply).toHaveBeenCalledTimes(1)
  })

  it('supports aggressive interruption action profile for hold-window interruptions', () => {
    const onInterruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      interruptionActionProfile: 'aggressive',
      now: () => 10_000,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => 9_900,
      onInterruptPlayback,
      onCancelPendingReply,
      onTurnReady: async () => {},
    })

    orchestrator.start()
    orchestrator.handleSpeechActivity('Learner starts talking')

    expect(onInterruptPlayback).toHaveBeenCalledTimes(1)
    expect(onCancelPendingReply).toHaveBeenCalledTimes(1)
  })

  it('delegates outside-hold-window handling without canceling reply', () => {
    const onInterruptionDecision = vi.fn()

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      now: () => 10_000,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => 9_700,
      onInterruptPlayback: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onTurnReady: async () => {},
      decideInterruption: () => ({
        shouldInterrupt: false,
        interruptPlayback: false,
        cancelPendingReply: false,
        reason: 'outside_hold_window',
      }),
      onInterruptionDecision,
    })

    orchestrator.start()
    orchestrator.handleSpeechActivity('new thought')

    expect(onInterruptionDecision).toHaveBeenCalledTimes(1)
    expect(onInterruptionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'speech_activity',
        decision: expect.objectContaining({
          reason: 'outside_hold_window',
          shouldInterrupt: false,
        }),
      }),
    )
  })

  it('does not execute interruption actions when session becomes invalid', () => {
    const onInterruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()
    let identityReadCount = 0

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => {
        identityReadCount += 1
        return identityReadCount === 1 ? 'session-1' : 'session-2'
      },
      isStopRequested: () => false,
      isPlaybackActive: () => true,
      hasPendingReply: () => true,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => Date.now(),
      onInterruptPlayback,
      onCancelPendingReply,
      onTurnReady: async () => {},
    })

    orchestrator.start()
    orchestrator.handleSpeechActivity('hello')

    expect(onInterruptPlayback).not.toHaveBeenCalled()
    expect(onCancelPendingReply).not.toHaveBeenCalled()
  })

  it('treats stop-requested sessions as invalid for interruption actions', () => {
    const onInterruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()
    let stopCallCount = 0

    const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => {
        stopCallCount += 1
        return stopCallCount > 1
      },
      isPlaybackActive: () => true,
      hasPendingReply: () => true,
      getActiveReplyId: () => 'stream-1',
      getLastAssistantActivityAt: () => Date.now(),
      onInterruptPlayback,
      onCancelPendingReply,
      onTurnReady: async () => {},
    })

    orchestrator.start()
    orchestrator.handleSpeechActivity('hello')

    expect(onInterruptPlayback).not.toHaveBeenCalled()
    expect(onCancelPendingReply).not.toHaveBeenCalled()
  })
})
