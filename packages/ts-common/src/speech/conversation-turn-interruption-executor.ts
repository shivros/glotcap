import { normalizeTurnInterruptionHoldMs } from './turn-interruption-config'
import {
  applyInterruptionActionProfile,
  resolveTurnInterruptionDecision,
} from './turn-interruption-policy'
import type {
  TurnInterruptionActionProfile,
  TurnInterruptionDecision,
} from './turn-interruption-policy'

type InterruptionSource = 'speech_activity' | 'turn_flush'

export type ConversationTurnPlaybackStatePort = {
  isPlaybackActive: () => boolean
}

export type ConversationTurnPendingReplyStatePort = {
  hasPendingReply: () => boolean
  getActiveReplyId?: () => string | null
}

export type ConversationTurnAssistantActivityPort = {
  getLastAssistantActivityAt: () => number | null
}

export type ConversationTurnSessionStatePort<
  TIdentity extends string = string,
> = {
  isSessionCurrent: (identity: TIdentity) => boolean
}

export type ConversationTurnInterruptionStatePort<
  TIdentity extends string = string,
> = Partial<
  ConversationTurnPlaybackStatePort &
    ConversationTurnPendingReplyStatePort &
    ConversationTurnAssistantActivityPort &
    ConversationTurnSessionStatePort<TIdentity>
>

export type ConversationTurnPlaybackInterruptionActionPort = {
  interruptPlayback: () => void
}

export type ConversationTurnPendingReplyActionPort = {
  cancelPendingReply: () => void
}

export type ConversationTurnInterruptionActionPort = Partial<
  ConversationTurnPlaybackInterruptionActionPort &
    ConversationTurnPendingReplyActionPort
>

export type ConversationTurnInterruptionContext<
  TIdentity extends string = string,
> = {
  identity: TIdentity
  activeReplyId: string | null
  hasPendingReply: boolean
  isPlaybackActive: boolean
  lastAssistantActivityAt: number | null
  sessionInvalidated: boolean
  now: number
  holdMs: number
}

export type ConversationTurnInterruptionDecision = {
  shouldInterrupt: boolean
  interruptPlayback: boolean
  cancelPendingReply: boolean
  reason?: TurnInterruptionDecision['reason'] | 'custom'
}

type ConversationTurnInterruptionExecutorConfig<
  TIdentity extends string = string,
> = {
  statePort: ConversationTurnInterruptionStatePort<TIdentity>
  actionPort?: ConversationTurnInterruptionActionPort
  interruptionHoldMs?: number
  interruptionActionProfile?: TurnInterruptionActionProfile
  applyProfileToCustomDecision?: boolean
  now?: () => number
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
}

export type ConversationTurnInterruptionExecutor<
  TIdentity extends string = string,
> = {
  evaluateAndExecute: (args: {
    identity: TIdentity
    source: InterruptionSource
  }) => {
    context: ConversationTurnInterruptionContext<TIdentity>
    decision: ConversationTurnInterruptionDecision
  }
}

const defaultInterruptionDecision = <TIdentity extends string = string>(
  context: ConversationTurnInterruptionContext<TIdentity>,
): ConversationTurnInterruptionDecision => {
  const decision = resolveTurnInterruptionDecision({
    activeStreamId: context.activeReplyId,
    hasPendingReply: context.hasPendingReply,
    isAiPlaying: context.isPlaybackActive,
    lastAiAudioActivityAt: context.lastAssistantActivityAt,
    now: context.now,
    holdMs: context.holdMs,
    sessionInvalidated: context.sessionInvalidated,
  })

  return {
    shouldInterrupt: decision.shouldInterrupt,
    interruptPlayback: decision.interruptPlayback,
    cancelPendingReply: decision.cancelPendingReply,
    reason: decision.reason,
  }
}

export const createConversationTurnInterruptionExecutor = <
  TIdentity extends string = string,
>(
  config: ConversationTurnInterruptionExecutorConfig<TIdentity>,
): ConversationTurnInterruptionExecutor<TIdentity> => {
  const now = config.now ?? Date.now
  const holdMs = normalizeTurnInterruptionHoldMs(config.interruptionHoldMs)
  const actionProfile = config.interruptionActionProfile ?? 'default'
  const applyProfileToCustomDecision =
    config.applyProfileToCustomDecision ?? true

  return {
    evaluateAndExecute({ identity, source }) {
      const isPlaybackActive = config.statePort.isPlaybackActive?.() ?? false
      const hasPendingReply = config.statePort.hasPendingReply?.() ?? false
      const lastAssistantActivityAt =
        config.statePort.getLastAssistantActivityAt?.() ?? null
      const sessionInvalidated =
        config.statePort.isSessionCurrent?.(identity) === false
      const activeReplyId =
        config.statePort.getActiveReplyId?.() ??
        (hasPendingReply || isPlaybackActive || lastAssistantActivityAt !== null
          ? identity
          : null)

      const context: ConversationTurnInterruptionContext<TIdentity> = {
        identity,
        activeReplyId,
        hasPendingReply,
        isPlaybackActive,
        lastAssistantActivityAt,
        sessionInvalidated,
        now: now(),
        holdMs,
      }

      const decisionFromPolicy = config.decideInterruption
        ? config.decideInterruption(context)
        : defaultInterruptionDecision(context)
      const normalizedDecision: ConversationTurnInterruptionDecision = {
        shouldInterrupt: decisionFromPolicy.shouldInterrupt,
        interruptPlayback: decisionFromPolicy.interruptPlayback,
        cancelPendingReply: decisionFromPolicy.cancelPendingReply,
        reason: decisionFromPolicy.reason ?? 'custom',
      }
      const decision: ConversationTurnInterruptionDecision =
        config.decideInterruption && !applyProfileToCustomDecision
          ? normalizedDecision
          : applyInterruptionActionProfile(normalizedDecision, actionProfile)

      config.onInterruptionDecision?.({
        source,
        context,
        decision,
      })

      if (decision.shouldInterrupt) {
        if (decision.interruptPlayback) {
          config.actionPort?.interruptPlayback?.()
        }
        if (decision.cancelPendingReply) {
          config.actionPort?.cancelPendingReply?.()
        }
        config.onInterruptionExecuted?.({
          source,
          context,
          decision,
        })
      }

      return { context, decision }
    },
  }
}
