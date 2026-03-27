import {
  VOICE_SESSION_OBSERVABILITY_EVENTS,
  createNoopVoiceSessionObserver,
} from './voice-observability'
import type {
  ConversationTurnInterruptionContext,
  ConversationTurnInterruptionDecision,
} from './conversation-turn-interruption-executor'
import type { ConversationTurnStaleDropReason } from './conversation-turn-stale-session-guard'
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

type ConversationTurnObservabilityConfig<TIdentity extends string = string> = {
  observer?: VoiceSessionObserver
  now: () => number
  getConversationIdentity: () => TIdentity | null
}

type EmitInterruptionDecisionArgs<TIdentity extends string = string> = {
  source: InterruptionSource
  context: ConversationTurnInterruptionContext<TIdentity>
  decision: ConversationTurnInterruptionDecision
}

type EmitInterruptionExecutedArgs<TIdentity extends string = string> = {
  source: InterruptionSource
  context: ConversationTurnInterruptionContext<TIdentity>
  decision: ConversationTurnInterruptionDecision
}

type EmitStaleDropArgs<TIdentity extends string = string> = {
  phase: string
  reason: ConversationTurnStaleDropReason
  expectedIdentity: TIdentity | null
  textLength: number
}

export type ConversationTurnObservabilityEmitter<
  TIdentity extends string = string,
> = {
  emitStartupRequested: () => void
  emitStartupReady: () => void
  emitStartupCanceled: (reason?: string) => void
  emitTurnOrchestratorStarted: () => void
  emitVoiceTurnCanceled: (reason?: string) => void
  emitTurnScheduled: (args: {
    identity: TIdentity
    trigger: FlushTrigger
    delayMs: number
  }) => void
  emitTurnScheduleCanceled: (args: {
    reason: TurnScheduleCancelReason
    identity: TIdentity
    trigger: FlushTrigger
  }) => void
  emitTurnFlushed: (args: {
    identity: TIdentity
    trigger: FlushTrigger
  }) => void
  emitTranscriptFlushTriggered: (args: {
    identity: TIdentity
    trigger: FlushTrigger
  }) => void
  emitTranscriptFlushStart: (args: {
    identity: TIdentity
    textLength: number
  }) => void
  emitTranscriptFlushSent: (args: {
    identity: TIdentity
    textLength: number
    skippedReply: boolean
    durationMs: number
  }) => void
  emitTranscriptFlushFailed: (args: {
    identity: TIdentity
    textLength: number
    durationMs: number
    error: string
  }) => void
  emitInterruptionDecision: (
    args: EmitInterruptionDecisionArgs<TIdentity>,
  ) => void
  emitInterruptionExecuted: (
    args: EmitInterruptionExecutedArgs<TIdentity>,
  ) => void
  emitStaleDrop: (args: EmitStaleDropArgs<TIdentity>) => void
}

export const createConversationTurnObservabilityEmitter = <
  TIdentity extends string = string,
>({
  observer = createNoopVoiceSessionObserver(),
  now,
  getConversationIdentity,
}: ConversationTurnObservabilityConfig<TIdentity>): ConversationTurnObservabilityEmitter<TIdentity> => {
  const emit = (name: string, details?: Record<string, unknown>) => {
    observer.emit({
      name,
      at: now(),
      details,
    })
  }

  return {
    emitStartupRequested() {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_REQUESTED, {
        scope: 'conversation_turn_orchestrator',
      })
    },
    emitStartupReady() {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_READY, {
        scope: 'conversation_turn_orchestrator',
      })
    },
    emitStartupCanceled(reason) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_CANCELED, {
        scope: 'conversation_turn_orchestrator',
        reason: reason ?? 'canceled',
      })
    },
    emitTurnOrchestratorStarted() {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_ORCHESTRATOR_STARTED)
    },
    emitVoiceTurnCanceled(reason) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.VOICE_TURN_CANCEL, {
        reason,
      })
    },
    emitTurnScheduled({ identity, trigger, delayMs }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_SCHEDULED, {
        identity,
        trigger,
        delayMs,
      })
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_SCHEDULED, {
        identity,
        trigger,
        delayMs,
      })
    },
    emitTurnScheduleCanceled({ reason, identity, trigger }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_SCHEDULE_CANCELED, {
        reason,
        identity,
        trigger,
      })
    },
    emitTurnFlushed({ identity, trigger }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_FLUSHED, {
        trigger,
        identity,
      })
    },
    emitTranscriptFlushTriggered({ identity, trigger }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_TRIGGERED, {
        trigger,
        identity,
      })
    },
    emitTranscriptFlushStart({ identity, textLength }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_START, {
        identity,
        textLength,
      })
    },
    emitTranscriptFlushSent({
      identity,
      textLength,
      skippedReply,
      durationMs,
    }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_SENT, {
        identity,
        textLength,
        skippedReply,
        durationMs,
      })
    },
    emitTranscriptFlushFailed({ identity, textLength, durationMs, error }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_FAILED, {
        identity,
        textLength,
        durationMs,
        error,
      })
    },
    emitInterruptionDecision({ source, context, decision }) {
      emit(
        decision.shouldInterrupt
          ? VOICE_SESSION_OBSERVABILITY_EVENTS.INTERRUPTION_TRIGGERED
          : VOICE_SESSION_OBSERVABILITY_EVENTS.INTERRUPTION_SKIPPED,
        {
          source,
          reason: decision.reason,
          identity: context.identity,
          activeReplyId: context.activeReplyId,
          isPlaybackActive: context.isPlaybackActive,
          hasPendingReply: context.hasPendingReply,
          sessionInvalidated: context.sessionInvalidated,
          holdMs: context.holdMs,
        },
      )
      if (context.sessionInvalidated) {
        emit(VOICE_SESSION_OBSERVABILITY_EVENTS.SESSION_SWITCH_INVALIDATED, {
          source: 'interruption_policy',
          trigger: source,
          identity: context.identity,
        })
      }
    },
    emitInterruptionExecuted({ source, context, decision }) {
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_INTERRUPTION_EXECUTED, {
        source,
        reason: decision.reason,
        interruptPlayback: decision.interruptPlayback,
        cancelPendingReply: decision.cancelPendingReply,
      })
      if (decision.interruptPlayback && context.isPlaybackActive) {
        emit(VOICE_SESSION_OBSERVABILITY_EVENTS.PLAYBACK_CANCELED, {
          source: 'turn_interruption',
          trigger: source,
          reason: decision.reason,
          identity: context.identity,
        })
      }
    },
    emitStaleDrop({ phase, reason, expectedIdentity, textLength }) {
      const nextIdentity = getConversationIdentity()
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROP, {
        phase,
        reason,
        expectedIdentity,
        textLength,
        nextIdentity,
      })
      emit(VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROPPED, {
        phase,
        reason,
        expectedIdentity,
        textLength,
        nextIdentity,
      })
      if (reason === 'identity_changed') {
        emit(VOICE_SESSION_OBSERVABILITY_EVENTS.SESSION_SWITCH_INVALIDATED, {
          source: 'stale_guard',
          phase,
          previousIdentity: expectedIdentity,
          nextIdentity,
        })
      }
    },
  }
}
