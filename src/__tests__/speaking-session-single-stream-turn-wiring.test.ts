import { describe, expect, it, vi } from 'vitest'

type CapturedConfig = {
  interruptionActionProfile?: string
  observer?: unknown
  onTurnReady?: (args: { identity: string; text: string }) => Promise<void>
  onCancelPendingReply?: () => void
  onInterruptionDecision?: (args: {
    source: 'speech_activity' | 'turn_flush'
    decision: { reason: string }
  }) => void
  onError?: (err: unknown, args: { identity: string; text: string }) => void
}

const createOrchestratorStub = () => ({
  start: vi.fn(() => true),
  cancel: vi.fn(),
  dispose: vi.fn(),
  handleSpeechActivity: vi.fn(),
  handleFinalTranscript: vi.fn(),
  handleTranscriptComplete: vi.fn(),
  flushNow: vi.fn(async () => {}),
  getBufferedText: vi.fn(() => ''),
  getLifecycleState: vi.fn(() => 'idle'),
  isActive: vi.fn(() => false),
})

describe('createSpeakingSessionSingleStreamTurnController wiring', () => {
  it('defaults interruption action profile to aggressive', async () => {
    let capturedConfig: CapturedConfig | null = null

    vi.resetModules()
    vi.doMock('@/lib/speaking-session-shared-turn-orchestrator', () => ({
      createSpeakingSessionSharedTurnOrchestrator: vi.fn((config) => {
        capturedConfig = config as CapturedConfig
        return createOrchestratorStub()
      }),
    }))

    const { createSpeakingSessionSingleStreamTurnController } =
      await import('@/lib/speaking-session-single-stream-turn')

    createSpeakingSessionSingleStreamTurnController({
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

    expect(capturedConfig).toBeTruthy()
    const config = capturedConfig as unknown as CapturedConfig
    expect(config.interruptionActionProfile).toBe('aggressive')

    vi.doUnmock('@/lib/speaking-session-shared-turn-orchestrator')
  })

  it('forwards explicit interruption action profile overrides', async () => {
    let capturedConfig: CapturedConfig | null = null
    const observer = { emit: vi.fn() }

    vi.resetModules()
    vi.doMock('@/lib/speaking-session-shared-turn-orchestrator', () => ({
      createSpeakingSessionSharedTurnOrchestrator: vi.fn((config) => {
        capturedConfig = config as CapturedConfig
        return createOrchestratorStub()
      }),
    }))

    const { createSpeakingSessionSingleStreamTurnController } =
      await import('@/lib/speaking-session-single-stream-turn')

    createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      interruptionActionProfile: 'default',
      observer,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      interruptPlayback: vi.fn(),
    })

    expect(capturedConfig).toBeTruthy()
    const config = capturedConfig as unknown as CapturedConfig
    expect(config.interruptionActionProfile).toBe('default')
    expect(config.observer).toBe(observer)

    vi.doUnmock('@/lib/speaking-session-shared-turn-orchestrator')
  })

  it('delegates runtime events and uses latest callbacks for interruption actions', async () => {
    let capturedConfig: CapturedConfig | null = null
    const sharedOrchestrator = createOrchestratorStub()
    const interruptPlayback = vi.fn()
    const firstCallbacks = {
      onTurnReady: vi.fn(async () => {}),
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onError: vi.fn(),
    }
    const secondCallbacks = {
      onTurnReady: vi.fn(async () => {}),
      onOutsideHoldWindow: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onError: vi.fn(),
    }

    vi.resetModules()
    vi.doMock('@/lib/speaking-session-shared-turn-orchestrator', () => ({
      createSpeakingSessionSharedTurnOrchestrator: vi.fn((config) => {
        capturedConfig = config as CapturedConfig
        return sharedOrchestrator
      }),
    }))

    const { createSpeakingSessionSingleStreamTurnController } =
      await import('@/lib/speaking-session-single-stream-turn')

    const controller = createSpeakingSessionSingleStreamTurnController({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      interruptPlayback,
    })

    expect(capturedConfig).toBeTruthy()
    const config = capturedConfig as unknown as CapturedConfig
    controller.setCallbacks(firstCallbacks)
    controller.start()
    controller.cancel('manual')
    controller.dispose()
    controller.onSpeechActivity('hola')
    controller.onFinalTranscript('mundo')
    controller.onTranscriptComplete()

    expect(sharedOrchestrator.start).toHaveBeenCalledTimes(1)
    expect(sharedOrchestrator.cancel).toHaveBeenCalledWith('manual')
    expect(sharedOrchestrator.dispose).toHaveBeenCalledTimes(1)
    expect(sharedOrchestrator.handleSpeechActivity).toHaveBeenCalledWith('hola')
    expect(sharedOrchestrator.handleFinalTranscript).toHaveBeenCalledWith(
      'mundo',
    )
    expect(sharedOrchestrator.handleTranscriptComplete).toHaveBeenCalledTimes(1)

    await config.onTurnReady?.({ identity: 'session-1', text: 'hola' })
    config.onCancelPendingReply?.()
    config.onInterruptionDecision?.({
      source: 'speech_activity',
      decision: { reason: 'outside_hold_window' },
    })
    config.onInterruptionDecision?.({
      source: 'turn_flush',
      decision: { reason: 'outside_hold_window' },
    })
    config.onInterruptionDecision?.({
      source: 'speech_activity',
      decision: { reason: 'missing_context' },
    })
    config.onError?.(new Error('boom'), {
      identity: 'session-1',
      text: 'hola',
    })

    expect(firstCallbacks.onTurnReady).toHaveBeenCalledWith({
      identity: 'session-1',
      text: 'hola',
    })
    expect(firstCallbacks.onCancelPendingReply).toHaveBeenCalledTimes(1)
    expect(firstCallbacks.onOutsideHoldWindow).toHaveBeenCalledTimes(1)
    expect(firstCallbacks.onError).toHaveBeenCalledTimes(1)

    controller.setCallbacks(secondCallbacks)
    await config.onTurnReady?.({ identity: 'session-1', text: 'next' })
    config.onCancelPendingReply?.()

    expect(secondCallbacks.onTurnReady).toHaveBeenCalledWith({
      identity: 'session-1',
      text: 'next',
    })
    expect(secondCallbacks.onCancelPendingReply).toHaveBeenCalledTimes(1)
    expect(firstCallbacks.onCancelPendingReply).toHaveBeenCalledTimes(1)
    expect(interruptPlayback).not.toHaveBeenCalled()

    vi.doUnmock('@/lib/speaking-session-shared-turn-orchestrator')
  })
})
