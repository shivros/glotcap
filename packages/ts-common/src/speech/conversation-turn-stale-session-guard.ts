import type { SessionLifecycleGate } from './session-lifecycle-gate'

export type ConversationTurnStaleDropReason =
  | 'lifecycle_stale'
  | 'orchestrator_inactive'
  | 'stop_requested'
  | 'missing_identity'
  | 'identity_changed'

export type ConversationTurnStaleDrop<TIdentity extends string = string> = {
  phase: string
  reason: ConversationTurnStaleDropReason
  expectedIdentity: TIdentity | null
  textLength: number
}

type ConversationTurnStaleGuardConfig<TIdentity extends string = string> = {
  lifecycleGate: SessionLifecycleGate
  isStarted: () => boolean
  isStopRequested: () => boolean
  getConversationIdentity: () => TIdentity | null
  onDrop?: (drop: ConversationTurnStaleDrop<TIdentity>) => void
}

type GuardArgs<TIdentity extends string = string> = {
  phase: string
  expectedIdentity?: TIdentity | null
  textLength: number
  lifecycleToken?: number
}

type GuardResult<TIdentity extends string = string> =
  | { ok: true; identity: TIdentity }
  | { ok: false }

export type ConversationTurnStaleSessionGuard<
  TIdentity extends string = string,
> = {
  ensureCurrent: (args: GuardArgs<TIdentity>) => GuardResult<TIdentity>
}

export const createConversationTurnStaleSessionGuard = <
  TIdentity extends string = string,
>(
  config: ConversationTurnStaleGuardConfig<TIdentity>,
): ConversationTurnStaleSessionGuard<TIdentity> => {
  const drop = (
    phase: string,
    reason: ConversationTurnStaleDropReason,
    expectedIdentity: TIdentity | null,
    textLength: number,
  ) => {
    config.onDrop?.({
      phase,
      reason,
      expectedIdentity,
      textLength,
    })
    return { ok: false } as const
  }

  return {
    ensureCurrent({
      phase,
      expectedIdentity = null,
      textLength,
      lifecycleToken,
    }) {
      if (
        typeof lifecycleToken === 'number' &&
        !config.lifecycleGate.isCurrent(lifecycleToken)
      ) {
        return drop(phase, 'lifecycle_stale', expectedIdentity, textLength)
      }

      if (!config.isStarted()) {
        return drop(
          phase,
          'orchestrator_inactive',
          expectedIdentity,
          textLength,
        )
      }

      if (config.isStopRequested()) {
        return drop(phase, 'stop_requested', expectedIdentity, textLength)
      }

      const identity = config.getConversationIdentity()
      if (!identity) {
        return drop(phase, 'missing_identity', expectedIdentity, textLength)
      }

      if (expectedIdentity !== null && identity !== expectedIdentity) {
        return drop(phase, 'identity_changed', expectedIdentity, textLength)
      }

      return { ok: true, identity }
    },
  }
}
