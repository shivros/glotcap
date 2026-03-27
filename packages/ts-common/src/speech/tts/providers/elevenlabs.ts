import {
  requestElevenLabsSpeech,
  requestElevenLabsSpeechStream,
} from '../elevenlabs'
import { TtsError } from '../errors'
import type {
  TtsProvider,
  TtsResponse,
  TtsStreamResponse,
  TtsSynthesizeRequest,
} from '../types'

type CreateElevenLabsTtsProviderOptions = {
  apiKey: string
  defaultVoiceId?: string
  defaultModelId?: string
  defaultOutputFormat?: string
  enableLogging?: boolean
}

const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'

const resolveVoiceAndModel = (
  request: TtsSynthesizeRequest,
  options: CreateElevenLabsTtsProviderOptions,
) => {
  const voiceId = request.voiceId || options.defaultVoiceId
  const modelId = request.modelId || options.defaultModelId

  if (!voiceId) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'elevenlabs',
      message: 'Missing ElevenLabs voiceId in request and provider defaults.',
    })
  }

  if (!modelId) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'elevenlabs',
      message: 'Missing ElevenLabs modelId in request and provider defaults.',
    })
  }

  return { voiceId, modelId }
}

const mapSynthesizeRequest = (
  request: TtsSynthesizeRequest,
  options: CreateElevenLabsTtsProviderOptions,
) => {
  const { voiceId, modelId } = resolveVoiceAndModel(request, options)
  return {
    apiKey: options.apiKey,
    text: request.text,
    voiceId,
    modelId,
    languageCode: request.languageCode,
    outputFormat: request.outputFormat ?? options.defaultOutputFormat,
    optimizeStreamingLatency: request.optimizeStreamingLatency,
    enableLogging:
      request.enableLogging === undefined
        ? options.enableLogging
        : request.enableLogging,
  }
}

const mapSynthesizeResponse = (
  response: TtsResponse,
  modelId: string,
  sampleRateHertz: number | undefined,
) => ({
  ...response,
  provider: 'elevenlabs' as const,
  modelId,
  sampleRateHertz,
})

const mapStreamResponse = (
  response: TtsStreamResponse,
  modelId: string,
  sampleRateHertz: number | undefined,
) => ({
  ...response,
  provider: 'elevenlabs' as const,
  modelId,
  sampleRateHertz,
})

export const createElevenLabsTtsProvider = (
  options: CreateElevenLabsTtsProviderOptions,
): TtsProvider => ({
  name: 'elevenlabs',
  capabilities: {
    streaming: true,
    promptControl: false,
  },
  synthesize: async (request) => {
    const mappedRequest = mapSynthesizeRequest(request, {
      ...options,
      defaultOutputFormat: options.defaultOutputFormat ?? DEFAULT_OUTPUT_FORMAT,
    })
    const response = await requestElevenLabsSpeech(mappedRequest)
    return mapSynthesizeResponse(
      response,
      mappedRequest.modelId,
      request.sampleRateHertz,
    )
  },
  stream: async (request) => {
    const mappedRequest = mapSynthesizeRequest(request, {
      ...options,
      defaultOutputFormat: options.defaultOutputFormat ?? DEFAULT_OUTPUT_FORMAT,
    })
    const response = await requestElevenLabsSpeechStream(mappedRequest)
    return mapStreamResponse(
      response,
      mappedRequest.modelId,
      request.sampleRateHertz,
    )
  },
})
