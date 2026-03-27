export type TranscriptEvent = {
  text: string
  isFinal: boolean
  confidence?: number
}

export type SttProviderName = 'soniox' | 'deepgram'

export type SttCloseInfo = {
  code: number
  reason: string
  wasClean: boolean
}

export type SttClientHandlers = {
  onTranscript: (event: TranscriptEvent) => void
  onError?: (error: Error) => void
  onClose?: (info: SttCloseInfo) => void
  onStatus?: (status: 'connecting' | 'open' | 'ready' | 'closed') => void
}

export type SttClient = {
  sendAudio: (audio: ArrayBuffer) => void
  close: () => void
  isReady: () => boolean
}

export type BuildSttSessionArgs = {
  sampleRate: number
  sessionReferenceId: string
  language?: string
  model?: string
  ttlSeconds?: number
}
