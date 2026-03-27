import { createNoopVoiceSessionObserver } from '../voice-observability'
import type { VoiceSessionObserver } from '../voice-observability'
import type { SttTranscriptHandler } from './stt-transcript-handler'

export type DefaultSttTranscriptHandlerOptions = {
  emitSpeechActivityOnFinal?: boolean
  haltPlaybackOnInterim?: boolean
  haltPlaybackOnFinalWhenPlaybackActive?: boolean
  observer?: VoiceSessionObserver
}

export const createDefaultSttTranscriptHandler = <
  TSessionId extends string = string,
>(
  options?: DefaultSttTranscriptHandlerOptions,
): SttTranscriptHandler<TSessionId> => ({
  handle: ({ sessionId, event, state, playback, transcript }) => {
    const emitSpeechActivityOnFinal = options?.emitSpeechActivityOnFinal ?? true
    const haltPlaybackOnInterim = options?.haltPlaybackOnInterim ?? true
    const haltPlaybackOnFinalWhenPlaybackActive =
      options?.haltPlaybackOnFinalWhenPlaybackActive ?? true
    const observer = options?.observer ?? createNoopVoiceSessionObserver()
    const activeSessionId = state.getActiveSessionId()

    if (state.isStopRequested()) {
      observer.emit({
        name: 'stale_callback_drop',
        details: {
          phase: 'stt_transcript',
          reason: 'stop_requested',
          sessionId,
          isFinal: event.isFinal,
        },
      })
      return
    }
    if (activeSessionId !== sessionId) {
      observer.emit({
        name: 'stale_callback_drop',
        details: {
          phase: 'stt_transcript',
          reason: 'session_stale',
          sessionId,
          activeSessionId,
          isFinal: event.isFinal,
        },
      })
      return
    }

    const text = event.text.trim()
    if (!event.isFinal || (emitSpeechActivityOnFinal && text)) {
      transcript.onSpeechActivity({ sessionId, text })
    }

    if (!event.isFinal) {
      const playbackActive = playback.isPlaybackActive()
      if (haltPlaybackOnInterim) {
        playback.haltPlayback()
        if (playbackActive) {
          observer.emit({
            name: 'playback_canceled',
            details: {
              source: 'stt_transcript',
              reason: 'interim_interrupt',
              sessionId,
              isFinal: false,
            },
          })
        }
      }
      return
    }

    const playbackActive = playback.isPlaybackActive()
    if (playbackActive && haltPlaybackOnFinalWhenPlaybackActive) {
      playback.haltPlayback()
      observer.emit({
        name: 'playback_canceled',
        details: {
          source: 'stt_transcript',
          reason: 'playback_active',
          sessionId,
          isFinal: event.isFinal,
        },
      })
      return
    }
    if (!text) {
      return
    }

    try {
      transcript.onTranscript({ sessionId, text })
    } catch (err) {
      console.error('Failed to handle transcript', err)
    } finally {
      transcript.onTranscriptComplete()
    }
  },
})
