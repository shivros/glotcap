import { createTtsTextPreprocessor } from '../../shared/tts-text-preprocessor'
import type { TtsTextPreprocessor } from '../../shared/tts-text-preprocessor'

type TtsConfig = {
  voiceId?: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
  latencyHint?: number
}

type SynthesizeSpeech = (args: {
  text: string
  voiceId?: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
  optimizeStreamingLatency?: number
}) => Promise<{ audioBase64: string; mimeType: string }>

type StreamResponse = {
  stream: ReadableStream<Uint8Array>
  mimeType: string
  cancel: () => void
}

export type CoachTtsPortConfig = {
  ttsStreamUrl: URL | null
  ttsConfig: TtsConfig
  synthesizeSpeech: SynthesizeSpeech
  preprocessor?: TtsTextPreprocessor
}

export type CoachTtsPort = {
  prepareText: (text: string) => string | null
  stream: (text: string) => Promise<StreamResponse>
  synthesize: (
    text: string,
  ) => Promise<{ audioBase64: string; mimeType: string }>
}

const DEFAULT_TTS_TEXT_PREPROCESSOR = createTtsTextPreprocessor()

export const createCoachTtsPort = ({
  getConfig,
}: {
  getConfig: () => CoachTtsPortConfig
}): CoachTtsPort => {
  const prepareText = (text: string) => {
    const { preprocessor } = getConfig()
    const processText = preprocessor ?? DEFAULT_TTS_TEXT_PREPROCESSOR
    const result = processText(text)
    if (!result.ok) {
      return null
    }
    return result.text
  }

  return {
    prepareText,
    stream: async (text: string) => {
      const preparedText = prepareText(text)
      if (!preparedText) {
        throw new Error('TTS text empty after preprocessing.')
      }

      const { ttsStreamUrl, ttsConfig } = getConfig()

      if (!ttsStreamUrl) {
        throw new Error('TTS streaming unavailable.')
      }

      const controller = new AbortController()
      const response = await fetch(ttsStreamUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: preparedText,
          voiceId: ttsConfig.voiceId,
          modelId: ttsConfig.modelId,
          languageCode: ttsConfig.languageCode,
          outputFormat: ttsConfig.outputFormat,
          optimizeStreamingLatency: ttsConfig.latencyHint,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'TTS streaming failed.')
      }

      if (!response.body) {
        throw new Error('TTS streaming response missing audio.')
      }

      return {
        stream: response.body,
        mimeType: response.headers.get('Content-Type') ?? 'audio/mpeg',
        cancel: () => controller.abort(),
      }
    },
    synthesize: async (text: string) => {
      const preparedText = prepareText(text)
      if (!preparedText) {
        throw new Error('TTS text empty after preprocessing.')
      }

      const { ttsConfig, synthesizeSpeech } = getConfig()

      return synthesizeSpeech({
        text: preparedText,
        voiceId: ttsConfig.voiceId,
        modelId: ttsConfig.modelId,
        languageCode: ttsConfig.languageCode,
        outputFormat: ttsConfig.outputFormat,
        optimizeStreamingLatency: ttsConfig.latencyHint,
      })
    },
  }
}

export type { SynthesizeSpeech, StreamResponse, TtsConfig }
