import { createConversationTurnFlushScheduler } from './conversation-turn-flush-scheduler'
import { createConversationTurnInterruptionExecutor } from './conversation-turn-interruption-executor'
import { createConversationTurnObservabilityEmitter } from './conversation-turn-observability'
import { createConversationTurnStaleSessionGuard } from './conversation-turn-stale-session-guard'
import { createSessionLifecycleGate } from './session-lifecycle-gate'
import { createStartupLifecycle } from './startup-lifecycle'
import { createTranscriptAccumulator } from './transcript-accumulator'
import { resolveVoiceTurnBoundaryPolicy } from './turn-boundary-policy'
import type {
  ConversationTurnAssistantActivityPort,
  ConversationTurnInterruptionActionPort,
  ConversationTurnInterruptionContext,
  ConversationTurnInterruptionDecision,
  ConversationTurnInterruptionStatePort,
  ConversationTurnPendingReplyActionPort,
  ConversationTurnPendingReplyStatePort,
  ConversationTurnPlaybackInterruptionActionPort,
  ConversationTurnPlaybackStatePort,
  ConversationTurnSessionStatePort,
} from './conversation-turn-interruption-executor'
import type { StartupLifecyclePort } from './startup-lifecycle'
import type { TurnInterruptionActionProfile } from './turn-interruption-policy'
import type { VoiceTurnBoundaryPolicyInput } from './turn-boundary-policy'
import type { VoiceSessionObserver } from './voice-observability'

type InterruptionSource = 'speech_activity' | 'turn_flush'
type FlushTrigger =
  | 'speech_activity_rearm'
  | 'final_transcript'
  | 'transcript_complete'
  | 'manual_flush'
type TurnScheduleCancelReason =
  | 'speech_activity'
  | 'flush_start'
  | 'reset_buffer'
  | 'rescheduled'
  | 'cancel'
  | 'stale_drop'
  | 'identity_rollover'
  | 'startup_reset'

export type ConversationTurnLifecycleState =
  | 'idle'
  | 'started'
  | 'canceled'
  | 'disposed'

export type ConversationTurnCorePorts<
  TIdentity extends string = string,
  TSendResult = unknown,
> = {
  getConversationIdentity: () => TIdentity | null
  isStopRequested: () => boolean
  sendTurn: (args: {
    identity: TIdentity
    text: string
  }) => Promise<TSendResult>
  playReply: (args: { identity: TIdentity; result: TSendResult }) => void
}

export type ConversationTurnOrchestratorPorts<
  TIdentity extends string = string,
  TSendResult = unknown,
> = ConversationTurnCorePorts<TIdentity, TSendResult> &
  ConversationTurnInterruptionStatePort<TIdentity> &
  ConversationTurnInterruptionActionPort

export type {
  ConversationTurnAssistantActivityPort,
  ConversationTurnInterruptionActionPort,
  ConversationTurnInterruptionContext,
  ConversationTurnInterruptionDecision,
  ConversationTurnInterruptionStatePort,
  ConversationTurnPendingReplyActionPort,
  ConversationTurnPendingReplyStatePort,
  ConversationTurnPlaybackInterruptionActionPort,
  ConversationTurnPlaybackStatePort,
  ConversationTurnSessionStatePort,
}

export type ConversationTurnOrchestratorConfig<
  TIdentity extends string = string,
  TSendResult = unknown,
> = {
  ports: ConversationTurnOrchestratorPorts<TIdentity, TSendResult>
  policy?: VoiceTurnBoundaryPolicyInput
  interruptionHoldMs?: number
  interruptionActionProfile?: TurnInterruptionActionProfile
  applyInterruptionActionProfileToCustomDecision?: boolean
  now?: () => number
  startupLifecycle?: StartupLifecyclePort
  shouldPlayReply?: (result: TSendResult) => boolean
  decideInterruption?: (
    context: ConversationTurnInterruptionContext<TIdentity>,
  ) => ConversationTurnInterruptionDecision
  onInterruptionDecision?: (args: {
    source: InterruptionSource
    context: ConversationTurnInterruptionContext<TIdentity>
    decision: ConversationTurnInterruptionDecision
  }) => void
  onInterruptionExecuted?: (args: {
    source: InterruptionSource
    context: ConversationTurnInterruptionContext<TIdentity>
    decision: ConversationTurnInterruptionDecision
  }) => void
  onFlushStart?: (args: { identity: TIdentity; text: string }) => void
  onReplySkipped?: (args: { identity: TIdentity; text: string }) => void
  onError?: (err: unknown, args: { identity: TIdentity; text: string }) => void
  onCancel?: (args: { reason?: string }) => void
  observer?: VoiceSessionObserver
}

export type ConversationTurnOrchestrator = {
  start: () => boolean
  cancel: (reason?: string) => void
  dispose: () => void
  handleSpeechActivity: (text?: string) => void
  handleFinalTranscript: (text: string) => void
  handleTranscriptComplete: () => void
  flushNow: () => Promise<void>
  getBufferedText: () => string
  getLifecycleState: () => ConversationTurnLifecycleState
  isActive: () => boolean
}

export const createConversationTurnOrchestrator = <
  TIdentity extends string = string,
  TSendResult = unknown,
>(
  config: ConversationTurnOrchestratorConfig<TIdentity, TSendResult>,
): ConversationTurnOrchestrator => {
  const startupLifecycle = config.startupLifecycle ?? createStartupLifecycle()
  const now = config.now ?? Date.now
  const turnBoundaryPolicy = resolveVoiceTurnBoundaryPolicy(config.policy)
  const observability = createConversationTurnObservabilityEmitter<TIdentity>({
    observer: config.observer,
    now,
    getConversationIdentity: config.ports.getConversationIdentity,
  })

  const lifecycleGate = createSessionLifecycleGate()
  let lifecycleState: ConversationTurnLifecycleState = 'idle'
  let bufferedIdentity: TIdentity | null = null
  const queuedFlushIdentities: Array<TIdentity> = []

  const isStarted = () =>
    lifecycleState !== 'disposed' && startupLifecycle.isActive()

  const staleGuard = createConversationTurnStaleSessionGuard({
    lifecycleGate,
    isStarted,
    isStopRequested: config.ports.isStopRequested,
    getConversationIdentity: config.ports.getConversationIdentity,
    onDrop: ({ phase, reason, expectedIdentity, textLength }) =>
      observability.emitStaleDrop({
        phase,
        reason,
        expectedIdentity,
        textLength,
      }),
  })

  const flushScheduler = createConversationTurnFlushScheduler<
    TIdentity,
    FlushTrigger
  >({
    gapMs: turnBoundaryPolicy.responseGapMs,
    isActive: () => isStarted() && !config.ports.isStopRequested(),
    getLifecycleToken: () => lifecycleGate.snapshot(),
    onFire: (scheduledFlush) => {
      const check = staleGuard.ensureCurrent({
        phase: 'scheduled_flush',
        expectedIdentity: scheduledFlush.identity,
        lifecycleToken: scheduledFlush.lifecycleToken,
        textLength: accumulator.getText().length,
      })
      if (!check.ok) {
        resetBufferedTurn('stale_drop')
        return
      }
      void flushBufferedTurn(scheduledFlush.trigger)
    },
  })

  const cancelScheduledFlush = (reason: TurnScheduleCancelReason) => {
    const scheduledFlush = flushScheduler.getSchedule()
    flushScheduler.cancel()
    if (!scheduledFlush) {
      return
    }
    observability.emitTurnScheduleCanceled({
      reason,
      identity: scheduledFlush.identity,
      trigger: scheduledFlush.trigger,
    })
  }

  const interruptionExecutor =
    createConversationTurnInterruptionExecutor<TIdentity>({
      statePort: {
        isPlaybackActive: config.ports.isPlaybackActive,
        hasPendingReply: config.ports.hasPendingReply,
        getActiveReplyId: config.ports.getActiveReplyId,
        getLastAssistantActivityAt: config.ports.getLastAssistantActivityAt,
        isSessionCurrent: (identity) => {
          if (!isStarted() || config.ports.isStopRequested()) {
            return false
          }
          return config.ports.getConversationIdentity() === identity
        },
      },
      actionPort: {
        interruptPlayback: config.ports.interruptPlayback,
        cancelPendingReply: config.ports.cancelPendingReply,
      },
      interruptionHoldMs: config.interruptionHoldMs,
      interruptionActionProfile: config.interruptionActionProfile,
      applyProfileToCustomDecision:
        config.applyInterruptionActionProfileToCustomDecision,
      now,
      decideInterruption: config.decideInterruption,
      onInterruptionDecision: (args) => {
        observability.emitInterruptionDecision(args)
        config.onInterruptionDecision?.(args)
      },
      onInterruptionExecuted: (args) => {
        observability.emitInterruptionExecuted(args)
        config.onInterruptionExecuted?.(args)
      },
    })

  const resetBufferedTurn = (
    reason: TurnScheduleCancelReason = 'reset_buffer',
  ) => {
    cancelScheduledFlush(reason)
    queuedFlushIdentities.length = 0
    bufferedIdentity = null
    accumulator.reset()
  }

  const flushBufferedTurn = async (trigger: FlushTrigger) => {
    if (!bufferedIdentity) {
      return
    }

    const check = staleGuard.ensureCurrent({
      phase: 'flush_gate',
      expectedIdentity: bufferedIdentity,
      textLength: accumulator.getText().length,
    })
    if (!check.ok) {
      resetBufferedTurn('stale_drop')
      return
    }

    if (accumulator.isEmpty()) {
      bufferedIdentity = null
      cancelScheduledFlush('flush_start')
      return
    }

    queuedFlushIdentities.push(bufferedIdentity)
    bufferedIdentity = null
    cancelScheduledFlush('flush_start')
    observability.emitTurnFlushed({
      trigger,
      identity: check.identity,
    })
    observability.emitTranscriptFlushTriggered({
      trigger,
      identity: check.identity,
    })
    await accumulator.flush()
  }

  const scheduleFlush = (trigger: FlushTrigger) => {
    if (!isStarted()) {
      return
    }
    if (accumulator.isEmpty() || bufferedIdentity === null) {
      return
    }

    const check = staleGuard.ensureCurrent({
      phase: 'schedule',
      expectedIdentity: bufferedIdentity,
      textLength: accumulator.getText().length,
    })
    if (!check.ok) {
      resetBufferedTurn('stale_drop')
      return
    }

    const previousSchedule = flushScheduler.getSchedule()
    if (previousSchedule) {
      observability.emitTurnScheduleCanceled({
        reason: 'rescheduled',
        identity: previousSchedule.identity,
        trigger: previousSchedule.trigger,
      })
    }
    flushScheduler.schedule({
      identity: check.identity,
      trigger,
    })
    observability.emitTurnScheduled({
      identity: check.identity,
      trigger,
      delayMs: turnBoundaryPolicy.responseGapMs,
    })
  }

  const accumulator = createTranscriptAccumulator({
    onFlush: async (text) => {
      const expectedIdentity = queuedFlushIdentities.shift() ?? null
      if (!expectedIdentity) {
        return
      }

      const flushStartCheck = staleGuard.ensureCurrent({
        phase: 'flush_start',
        expectedIdentity,
        textLength: text.length,
      })
      if (!flushStartCheck.ok) {
        return
      }
      const identity = flushStartCheck.identity

      const sendToken = lifecycleGate.snapshot()
      const flushStartedAt = now()
      observability.emitTranscriptFlushStart({
        identity,
        textLength: text.length,
      })
      config.onFlushStart?.({
        identity,
        text,
      })

      interruptionExecutor.evaluateAndExecute({
        identity,
        source: 'turn_flush',
      })

      try {
        const result = await config.ports.sendTurn({
          identity,
          text,
        })

        const sendResultCheck = staleGuard.ensureCurrent({
          phase: 'send_result',
          expectedIdentity: identity,
          lifecycleToken: sendToken,
          textLength: text.length,
        })
        if (!sendResultCheck.ok) {
          return
        }

        const shouldPlayReply = config.shouldPlayReply
          ? config.shouldPlayReply(result)
          : true
        if (!shouldPlayReply) {
          config.onReplySkipped?.({ identity, text })
          observability.emitTranscriptFlushSent({
            identity,
            textLength: text.length,
            skippedReply: true,
            durationMs: now() - flushStartedAt,
          })
          return
        }

        config.ports.playReply({
          identity,
          result,
        })
        observability.emitTranscriptFlushSent({
          identity,
          textLength: text.length,
          skippedReply: false,
          durationMs: now() - flushStartedAt,
        })
      } catch (err) {
        const sendErrorCheck = staleGuard.ensureCurrent({
          phase: 'send_error',
          expectedIdentity: identity,
          lifecycleToken: sendToken,
          textLength: text.length,
        })
        if (!sendErrorCheck.ok) {
          return
        }

        observability.emitTranscriptFlushFailed({
          identity,
          textLength: text.length,
          durationMs: now() - flushStartedAt,
          error:
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'unknown',
        })
        config.onError?.(err, { identity, text })
      }
    },
  })

  const start = () => {
    if (lifecycleState === 'disposed') {
      return false
    }

    observability.emitStartupRequested()
    const token = startupLifecycle.beginStart()
    const started = startupLifecycle.completeStart(token)
    if (!started) {
      observability.emitStartupCanceled('startup_lifecycle_rejected')
      return false
    }

    lifecycleGate.invalidate()
    resetBufferedTurn('startup_reset')
    lifecycleState = 'started'
    observability.emitTurnOrchestratorStarted()
    observability.emitStartupReady()
    return true
  }

  const cancel = (reason?: string) => {
    if (lifecycleState === 'disposed') {
      return
    }

    startupLifecycle.cancel()
    lifecycleGate.invalidate()
    resetBufferedTurn('cancel')
    lifecycleState = 'canceled'
    observability.emitStartupCanceled(reason)
    observability.emitVoiceTurnCanceled(reason)
    config.onCancel?.({ reason })
  }

  return {
    start,
    cancel,
    dispose() {
      if (lifecycleState === 'disposed') {
        return
      }
      cancel('dispose')
      cancelScheduledFlush('cancel')
      flushScheduler.dispose()
      lifecycleState = 'disposed'
    },
    handleSpeechActivity() {
      if (!isStarted()) {
        return
      }

      cancelScheduledFlush('speech_activity')
      const check = staleGuard.ensureCurrent({
        phase: 'speech_activity',
        textLength: accumulator.getText().length,
      })
      if (!check.ok) {
        resetBufferedTurn('stale_drop')
        return
      }

      interruptionExecutor.evaluateAndExecute({
        identity: check.identity,
        source: 'speech_activity',
      })

      if (!accumulator.isEmpty() && bufferedIdentity === check.identity) {
        scheduleFlush('speech_activity_rearm')
      }
    },
    handleFinalTranscript(text) {
      if (!isStarted()) {
        return
      }

      const trimmed = text.trim()
      if (!trimmed) {
        return
      }

      const check = staleGuard.ensureCurrent({
        phase: 'final_transcript',
        textLength: trimmed.length,
      })
      if (!check.ok) {
        return
      }

      if (bufferedIdentity && bufferedIdentity !== check.identity) {
        observability.emitStaleDrop({
          phase: 'final_transcript',
          reason: 'identity_changed',
          expectedIdentity: bufferedIdentity,
          textLength: accumulator.getText().length,
        })
        resetBufferedTurn('identity_rollover')
      }

      if (!bufferedIdentity) {
        bufferedIdentity = check.identity
      }

      accumulator.append(trimmed)
      scheduleFlush('final_transcript')
    },
    handleTranscriptComplete() {
      if (!isStarted()) {
        return
      }
      scheduleFlush('transcript_complete')
    },
    async flushNow() {
      await flushBufferedTurn('manual_flush')
    },
    getBufferedText() {
      return accumulator.getText()
    },
    getLifecycleState() {
      return lifecycleState
    },
    isActive() {
      return isStarted() && !config.ports.isStopRequested()
    },
  }
}

export type { ConversationTurnScheduledFlush } from './conversation-turn-flush-scheduler'
export type {
  ConversationTurnStaleDrop,
  ConversationTurnStaleDropReason,
} from './conversation-turn-stale-session-guard'
