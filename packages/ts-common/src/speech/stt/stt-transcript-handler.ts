import type { TranscriptEvent } from './types'

export type ConnectionStatePort<TSessionId extends string = string> = {
  getActiveSessionId: () => TSessionId | null
  isStopRequested: () => boolean
}

export type PlaybackPort = {
  isPlaybackActive: () => boolean
  haltPlayback: () => void
}

export type TranscriptPort<TSessionId extends string = string> = {
  onSpeechActivity: (args: { sessionId: TSessionId; text: string }) => void
  onTranscript: (args: { sessionId: TSessionId; text: string }) => void
  onTranscriptComplete: () => void
}

export type SttTranscriptHandler<TSessionId extends string = string> = {
  handle: (args: {
    sessionId: TSessionId
    event: TranscriptEvent
    state: ConnectionStatePort<TSessionId>
    playback: PlaybackPort
    transcript: TranscriptPort<TSessionId>
  }) => void
}
