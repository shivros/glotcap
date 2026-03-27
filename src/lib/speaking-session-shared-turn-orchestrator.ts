import { createConversationTurnOrchestrator } from 'ts-common/speech/conversation-turn-orchestrator'
import type { TurnInterruptionActionProfile } from 'ts-common/speech/turn-interruption-policy'
import type { VoiceSessionObserver } from 'ts-common/speech/voice-observability'
import type {
  ConversationTurnInterruptionContext,
  ConversationTurnInterruptionDecision,
  ConversationTurnOrchestrator,
} from 'ts-common/speech/conversation-turn-orchestrator'

type TurnIdentity = string

type SpeakingSessionSharedTurnOrchestratorParams = {
  responseGapMs: number
  interruptionHoldMs: number
  interruptionActionProfile?: TurnInterruptionActionProfile
  applyInterruptionActionProfileToCustomDecision?: boolean
  now?: () => number
  getConversationIdentity: () => TurnIdentity | null
  isStopRequested: () => boolean
  isPlaybackActive: () => boolean
  hasPendingReply: () => boolean
  getActiveReplyId: () => string | null
  getLastAssistantActivityAt: () => number | null
  onInterruptPlayback: () => void
  onCancelPendingReply: () => void
  onTurnReady: (args: { identity: TurnIdentity; text: string }) => Promise<void>
  decideInterruption?: (
    context: ConversationTurnInterruptionContext<TurnIdentity>,
  ) => ConversationTurnInterruptionDecision
  onInterruptionDecision?: (args: {
    source: 'speech_activity' | 'turn_flush'
    context: ConversationTurnInterruptionContext<TurnIdentity>
    decision: ConversationTurnInterruptionDecision
  }) => void
  observer?: VoiceSessionObserver
  onError?: (
    err: unknown,
    args: { identity: TurnIdentity; text: string },
  ) => void
}

export const createSpeakingSessionSharedTurnOrchestrator = ({
  responseGapMs,
  interruptionHoldMs,
  interruptionActionProfile,
  applyInterruptionActionProfileToCustomDecision,
  now,
  getConversationIdentity,
  isStopRequested,
  isPlaybackActive,
  hasPendingReply,
  getActiveReplyId,
  getLastAssistantActivityAt,
  onInterruptPlayback,
  onCancelPendingReply,
  onTurnReady,
  decideInterruption,
  onInterruptionDecision,
  observer,
  onError,
}: SpeakingSessionSharedTurnOrchestratorParams): ConversationTurnOrchestrator =>
  createConversationTurnOrchestrator<TurnIdentity, void>({
    policy: {
      responseGapMs,
    },
    interruptionHoldMs,
    interruptionActionProfile,
    applyInterruptionActionProfileToCustomDecision,
    now,
    ports: {
      getConversationIdentity,
      isStopRequested,
      isPlaybackActive,
      hasPendingReply,
      getActiveReplyId,
      getLastAssistantActivityAt,
      interruptPlayback: onInterruptPlayback,
      cancelPendingReply: onCancelPendingReply,
      sendTurn: async ({ identity, text }) => {
        await onTurnReady({ identity, text })
      },
      playReply: () => {},
    },
    shouldPlayReply: () => false,
    decideInterruption,
    onInterruptionDecision,
    observer,
    onError,
  })
