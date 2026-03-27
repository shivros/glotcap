import type { ConversationTurnInterruptionDecision } from 'ts-common/speech/conversation-turn-orchestrator'
import type { TurnInterruptionActionProfile } from 'ts-common/speech/turn-interruption-policy'
import type { VoiceSessionObserver } from 'ts-common/speech/voice-observability'
import { createSpeakingSessionSharedTurnOrchestrator } from '@/lib/speaking-session-shared-turn-orchestrator'

type TurnIdentity = string

type SpeakingSessionSingleStreamTurnCallbacks = {
  onTurnReady: (args: { identity: TurnIdentity; text: string }) => Promise<void>
  onOutsideHoldWindow: () => void
  onCancelPendingReply: () => void
  onError: (
    err: unknown,
    args: { identity: TurnIdentity; text: string },
  ) => void
}

type SpeakingSessionSingleStreamTurnParams = {
  responseGapMs: number
  interruptionHoldMs: number
  interruptionActionProfile?: TurnInterruptionActionProfile
  observer?: VoiceSessionObserver
  now?: () => number
  getConversationIdentity: () => TurnIdentity | null
  isStopRequested: () => boolean
  isPlaybackActive: () => boolean
  hasPendingReply: () => boolean
  getActiveReplyId: () => string | null
  getLastAssistantActivityAt: () => number | null
  interruptPlayback: () => void
}

export type SpeakingSessionSingleStreamTurnController = {
  start: () => boolean
  cancel: (reason?: string) => void
  dispose: () => void
  onSpeechActivity: (text?: string) => void
  onFinalTranscript: (text: string) => void
  onTranscriptComplete: () => void
  setCallbacks: (callbacks: SpeakingSessionSingleStreamTurnCallbacks) => void
}

const NOOP_CALLBACKS: SpeakingSessionSingleStreamTurnCallbacks = {
  onTurnReady: async () => {},
  onOutsideHoldWindow: () => {},
  onCancelPendingReply: () => {},
  onError: () => {},
}

const isOutsideHoldWindowDecision = (
  source: 'speech_activity' | 'turn_flush',
  decision: ConversationTurnInterruptionDecision,
) => source === 'speech_activity' && decision.reason === 'outside_hold_window'

export const createSpeakingSessionSingleStreamTurnController = ({
  responseGapMs,
  interruptionHoldMs,
  interruptionActionProfile,
  observer,
  now,
  getConversationIdentity,
  isStopRequested,
  isPlaybackActive,
  hasPendingReply,
  getActiveReplyId,
  getLastAssistantActivityAt,
  interruptPlayback,
}: SpeakingSessionSingleStreamTurnParams): SpeakingSessionSingleStreamTurnController => {
  let callbacks = NOOP_CALLBACKS

  const orchestrator = createSpeakingSessionSharedTurnOrchestrator({
    responseGapMs,
    interruptionHoldMs,
    interruptionActionProfile: interruptionActionProfile ?? 'aggressive',
    observer,
    now,
    getConversationIdentity,
    isStopRequested,
    isPlaybackActive,
    hasPendingReply,
    getActiveReplyId,
    getLastAssistantActivityAt,
    onInterruptPlayback: interruptPlayback,
    onCancelPendingReply: () => callbacks.onCancelPendingReply(),
    onTurnReady: async ({ identity, text }) => {
      await callbacks.onTurnReady({ identity, text })
    },
    onInterruptionDecision: ({ source, decision }) => {
      if (isOutsideHoldWindowDecision(source, decision)) {
        callbacks.onOutsideHoldWindow()
      }
    },
    onError: (err, args) => {
      callbacks.onError(err, args)
    },
  })

  return {
    start: () => orchestrator.start(),
    cancel: (reason) => {
      orchestrator.cancel(reason)
    },
    dispose: () => {
      orchestrator.dispose()
    },
    onSpeechActivity: (text) => {
      orchestrator.handleSpeechActivity(text)
    },
    onFinalTranscript: (text) => {
      orchestrator.handleFinalTranscript(text)
    },
    onTranscriptComplete: () => {
      orchestrator.handleTranscriptComplete()
    },
    setCallbacks: (nextCallbacks) => {
      callbacks = nextCallbacks
    },
  }
}
