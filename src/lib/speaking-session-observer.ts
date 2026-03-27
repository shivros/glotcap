import {
  VOICE_SESSION_OBSERVABILITY_EVENTS,
  createConsoleVoiceSessionObserver,
} from 'ts-common/speech/voice-observability'
import type { VoiceSessionObserver } from 'ts-common/speech/voice-observability'

const LOGGABLE_EVENT_NAMES: ReadonlySet<string> = new Set([
  VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_REQUESTED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_READY,
  VOICE_SESSION_OBSERVABILITY_EVENTS.STARTUP_CANCELED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_SCHEDULED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_SCHEDULE_CANCELED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_FLUSHED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.INTERRUPTION_TRIGGERED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.INTERRUPTION_SKIPPED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TURN_INTERRUPTION_EXECUTED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROP,
  VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROPPED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.SESSION_SWITCH_INVALIDATED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.PLAYBACK_CANCELED,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_START,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_SENT,
  VOICE_SESSION_OBSERVABILITY_EVENTS.TRANSCRIPT_FLUSH_FAILED,
])

const resolveObserverEnabled = (): boolean => {
  const explicitFlag = import.meta.env.VITE_GLOTCAP_VOICE_DEBUG
  if (explicitFlag === 'true') {
    return true
  }
  if (explicitFlag === 'false') {
    return false
  }
  return import.meta.env.DEV && import.meta.env.MODE !== 'test'
}

type CreateSpeakingSessionObserverArgs = {
  enabled?: boolean
  getContext?: () => Record<string, unknown>
}

export const createSpeakingSessionObserver = (
  args: CreateSpeakingSessionObserverArgs = {},
): VoiceSessionObserver => {
  return createConsoleVoiceSessionObserver({
    scope: '[glotcap.voice]',
    enabled: args.enabled ?? resolveObserverEnabled(),
    loggableEventNames: LOGGABLE_EVENT_NAMES,
    getContext: args.getContext,
    staleDedupeTimestamp: 'event',
  })
}
