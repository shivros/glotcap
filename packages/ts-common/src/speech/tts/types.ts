export type TtsRequest = {
  text: string
  voiceId?: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
  sampleRateHertz?: number
  prompt?: string
  optimizeStreamingLatency?: number
  enableLogging?: boolean
}

export type TtsProviderName =
  | 'elevenlabs'
  | 'google_cloud_tts'
  | 'vertex_gemini_tts'

export type TtsProviderOptions = {
  fallbackProviders?: Array<TtsProviderName>
}

export type TtsResponse = {
  audio: Uint8Array
  mimeType: string
  provider?: TtsProviderName
  modelId?: string
  sampleRateHertz?: number
}

export type TtsStreamResponse = {
  stream: ReadableStream<Uint8Array>
  mimeType: string
  provider?: TtsProviderName
  modelId?: string
  sampleRateHertz?: number
}

export type TtsSynthesizeRequest = TtsRequest & {
  provider?: TtsProviderName
  providerOptions?: TtsProviderOptions
}

export type TtsStreamRequest = TtsSynthesizeRequest

export type TtsProviderCapabilities = {
  streaming: boolean
  promptControl: boolean
}

export type TtsProvider = {
  name: TtsProviderName
  capabilities: TtsProviderCapabilities
  synthesize: (request: TtsSynthesizeRequest) => Promise<TtsResponse>
  stream?: (request: TtsStreamRequest) => Promise<TtsStreamResponse>
}
