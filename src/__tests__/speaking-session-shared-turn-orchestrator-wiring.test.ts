import { describe, expect, it, vi } from 'vitest'

describe('createSpeakingSessionSharedTurnOrchestrator wiring', () => {
  it('passes interruption action profile through to shared orchestrator config', async () => {
    let capturedConfig: Record<string, unknown> | null = null
    const observer = { emit: vi.fn() }

    vi.resetModules()
    vi.doMock('ts-common/speech/conversation-turn-orchestrator', () => ({
      createConversationTurnOrchestrator: vi.fn((config) => {
        capturedConfig = config as Record<string, unknown>
        return {
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
        }
      }),
    }))

    const { createSpeakingSessionSharedTurnOrchestrator } =
      await import('@/lib/speaking-session-shared-turn-orchestrator')

    createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      interruptionActionProfile: 'aggressive',
      applyInterruptionActionProfileToCustomDecision: false,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      onInterruptPlayback: vi.fn(),
      onCancelPendingReply: vi.fn(),
      onTurnReady: () => Promise.resolve(),
      observer,
    })

    expect(capturedConfig).toBeTruthy()
    const config = capturedConfig as unknown as {
      interruptionActionProfile?: string
      applyInterruptionActionProfileToCustomDecision?: boolean
      observer?: unknown
    }
    expect(config.interruptionActionProfile).toBe('aggressive')
    expect(config.applyInterruptionActionProfileToCustomDecision).toBe(false)
    expect(config.observer).toBe(observer)

    vi.doUnmock('ts-common/speech/conversation-turn-orchestrator')
  })

  it('wraps shared ports and callbacks for turn delivery and interruption handling', async () => {
    let capturedConfig: Record<string, unknown> | null = null
    const onTurnReady = vi.fn(async () => {})
    const onInterruptPlayback = vi.fn()
    const onCancelPendingReply = vi.fn()
    const onInterruptionDecision = vi.fn()
    const onError = vi.fn()

    vi.resetModules()
    vi.doMock('ts-common/speech/conversation-turn-orchestrator', () => ({
      createConversationTurnOrchestrator: vi.fn((config) => {
        capturedConfig = config as Record<string, unknown>
        return {
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
        }
      }),
    }))

    const { createSpeakingSessionSharedTurnOrchestrator } =
      await import('@/lib/speaking-session-shared-turn-orchestrator')

    createSpeakingSessionSharedTurnOrchestrator({
      responseGapMs: 300,
      interruptionHoldMs: 250,
      getConversationIdentity: () => 'session-1',
      isStopRequested: () => false,
      isPlaybackActive: () => false,
      hasPendingReply: () => false,
      getActiveReplyId: () => null,
      getLastAssistantActivityAt: () => null,
      onInterruptPlayback,
      onCancelPendingReply,
      onTurnReady,
      onInterruptionDecision,
      onError,
    })

    const config = capturedConfig as unknown as {
      shouldPlayReply: () => boolean
      onInterruptionDecision?: (...args: Array<unknown>) => void
      onError?: (err: unknown, args: { identity: string; text: string }) => void
      ports: {
        sendTurn: (args: { identity: string; text: string }) => Promise<void>
        interruptPlayback: () => void
        cancelPendingReply: () => void
        playReply: () => void
      }
    }

    expect(config.shouldPlayReply()).toBe(false)

    await config.ports.sendTurn({ identity: 'session-1', text: 'hola' })
    expect(onTurnReady).toHaveBeenCalledWith({
      identity: 'session-1',
      text: 'hola',
    })

    config.ports.interruptPlayback()
    config.ports.cancelPendingReply()
    config.ports.playReply()
    expect(onInterruptPlayback).toHaveBeenCalledTimes(1)
    expect(onCancelPendingReply).toHaveBeenCalledTimes(1)

    config.onInterruptionDecision?.('args')
    expect(onInterruptionDecision).toHaveBeenCalledWith('args')

    const sampleError = new Error('send failed')
    config.onError?.(sampleError, { identity: 'session-1', text: 'hola' })
    expect(onError).toHaveBeenCalledWith(sampleError, {
      identity: 'session-1',
      text: 'hola',
    })

    vi.doUnmock('ts-common/speech/conversation-turn-orchestrator')
  })
})
