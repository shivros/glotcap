type TurnInterruptionParams = {
  activeStreamId: string | null
  hasPendingReply: boolean
  isAiPlaying: boolean
  lastAiAudioActivityAt: number | null
  now: number
  holdMs: number
  sessionInvalidated?: boolean
}

type TurnInterruptionReason =
  | 'session_invalidated'
  | 'pending_reply'
  | 'active_playback'
  | 'awaiting_assistant_audio'
  | 'within_hold_window'
  | 'outside_hold_window'
  | 'no_active_reply'

type TurnInterruptionDecision = {
  shouldInterrupt: boolean
  interruptPlayback: boolean
  cancelPendingReply: boolean
  reason: TurnInterruptionReason
}

type TurnInterruptionActionProfile = 'default' | 'aggressive'
type TurnInterruptionActionTarget = {
  shouldInterrupt: boolean
  interruptPlayback: boolean
  cancelPendingReply: boolean
}

export const shouldInterruptAiReply = ({
  activeStreamId,
  hasPendingReply,
  isAiPlaying,
  lastAiAudioActivityAt,
  now,
  holdMs,
  sessionInvalidated,
}: TurnInterruptionParams) => {
  return resolveTurnInterruptionDecision({
    activeStreamId,
    hasPendingReply,
    isAiPlaying,
    lastAiAudioActivityAt,
    now,
    holdMs,
    sessionInvalidated,
  }).shouldInterrupt
}

export const resolveTurnInterruptionDecision = ({
  activeStreamId,
  hasPendingReply,
  isAiPlaying,
  lastAiAudioActivityAt,
  now,
  holdMs,
  sessionInvalidated,
}: TurnInterruptionParams): TurnInterruptionDecision => {
  if (sessionInvalidated) {
    return {
      shouldInterrupt: false,
      interruptPlayback: false,
      cancelPendingReply: false,
      reason: 'session_invalidated',
    }
  }

  if (hasPendingReply) {
    return {
      shouldInterrupt: true,
      interruptPlayback: isAiPlaying,
      cancelPendingReply: true,
      reason: 'pending_reply',
    }
  }

  if (!activeStreamId) {
    return {
      shouldInterrupt: false,
      interruptPlayback: false,
      cancelPendingReply: false,
      reason: 'no_active_reply',
    }
  }

  if (isAiPlaying) {
    return {
      shouldInterrupt: true,
      interruptPlayback: true,
      cancelPendingReply: false,
      reason: 'active_playback',
    }
  }

  if (lastAiAudioActivityAt == null) {
    return {
      shouldInterrupt: true,
      interruptPlayback: false,
      cancelPendingReply: false,
      reason: 'awaiting_assistant_audio',
    }
  }

  const withinHoldWindow = now - lastAiAudioActivityAt <= holdMs
  if (withinHoldWindow) {
    return {
      shouldInterrupt: true,
      interruptPlayback: false,
      cancelPendingReply: false,
      reason: 'within_hold_window',
    }
  }

  return {
    shouldInterrupt: false,
    interruptPlayback: false,
    cancelPendingReply: false,
    reason: 'outside_hold_window',
  }
}

export const applyInterruptionActionProfile = <
  TDecision extends TurnInterruptionActionTarget,
>(
  decision: TDecision,
  profile: TurnInterruptionActionProfile = 'default',
): TDecision => {
  if (profile !== 'aggressive' || !decision.shouldInterrupt) {
    return decision
  }

  return {
    ...decision,
    interruptPlayback: true,
    cancelPendingReply: true,
  }
}

export const resolveTurnInterruptionDecisionForProfile = (
  params: TurnInterruptionParams,
  profile: TurnInterruptionActionProfile = 'default',
) =>
  applyInterruptionActionProfile(
    resolveTurnInterruptionDecision(params),
    profile,
  )

export type {
  TurnInterruptionActionProfile,
  TurnInterruptionDecision,
  TurnInterruptionParams,
}
