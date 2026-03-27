import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { TtsError } from '../errors'
import type { TtsProvider, TtsSynthesizeRequest } from '../types'

type GoogleCloudTextToSpeechClientLike = {
  synthesizeSpeech: (
    request: Record<string, unknown>,
  ) => Promise<Array<{ audioContent?: string | Uint8Array }>>
}

type CreateGoogleCloudTtsProviderOptions = {
  client?: GoogleCloudTextToSpeechClientLike
  clientOptions?: ConstructorParameters<typeof TextToSpeechClient>[0]
  projectId?: string
  location?: string
  defaultVoiceId?: string
  defaultModelId?: string
  defaultLanguageCode?: string
  defaultOutputFormat?: string
  defaultSampleRateHertz?: number
}

const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'
const DEFAULT_LANGUAGE_CODE = 'en-US'

type AudioConfig = {
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS' | 'MULAW' | 'ALAW'
  mimeType: string
  sampleRateHertz?: number
}

const parseSampleRateFromOutputFormat = (outputFormat: string) => {
  const match = outputFormat.match(/(\d{4,6})/)
  if (!match) {
    return undefined
  }
  const sampleRate = Number(match[1])
  return Number.isFinite(sampleRate) ? sampleRate : undefined
}

const resolveAudioConfig = (
  request: TtsSynthesizeRequest,
  options: CreateGoogleCloudTtsProviderOptions,
): AudioConfig => {
  const outputFormat = (
    request.outputFormat ??
    options.defaultOutputFormat ??
    DEFAULT_OUTPUT_FORMAT
  ).toLowerCase()

  const sampleRateHertz =
    request.sampleRateHertz ??
    parseSampleRateFromOutputFormat(outputFormat) ??
    options.defaultSampleRateHertz

  if (outputFormat.startsWith('wav') || outputFormat.includes('linear16')) {
    return {
      audioEncoding: 'LINEAR16',
      mimeType: 'audio/wav',
      sampleRateHertz,
    }
  }

  if (outputFormat.includes('ogg')) {
    return {
      audioEncoding: 'OGG_OPUS',
      mimeType: 'audio/ogg',
      sampleRateHertz,
    }
  }

  if (outputFormat.includes('mulaw')) {
    return {
      audioEncoding: 'MULAW',
      mimeType: 'audio/basic',
      sampleRateHertz,
    }
  }

  if (outputFormat.includes('alaw')) {
    return {
      audioEncoding: 'ALAW',
      mimeType: 'audio/basic',
      sampleRateHertz,
    }
  }

  return {
    audioEncoding: 'MP3',
    mimeType: 'audio/mpeg',
    sampleRateHertz,
  }
}

const toBytes = (audioContent: string | Uint8Array | undefined) => {
  if (!audioContent) {
    throw new TtsError({
      code: 'TTS_REQUEST_FAILED',
      provider: 'google_cloud_tts',
      message: 'Google Cloud TTS response missing audioContent.',
    })
  }

  if (typeof audioContent === 'string') {
    return new Uint8Array(Buffer.from(audioContent, 'base64'))
  }

  return audioContent
}

const createGoogleCloudClient = async (
  options: CreateGoogleCloudTtsProviderOptions,
): Promise<GoogleCloudTextToSpeechClientLike> => {
  await Promise.resolve()
  if (options.client) {
    return options.client
  }

  try {
    return new TextToSpeechClient(
      options.clientOptions,
    ) as GoogleCloudTextToSpeechClientLike
  } catch (error) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'google_cloud_tts',
      message:
        'Google Cloud TTS client unavailable. Install @google-cloud/text-to-speech and configure ADC credentials.',
      cause: error,
    })
  }
}

const buildSynthesizeRequest = (
  request: TtsSynthesizeRequest,
  options: CreateGoogleCloudTtsProviderOptions,
) => {
  const audioConfig = resolveAudioConfig(request, options)
  const voiceName = request.voiceId ?? options.defaultVoiceId
  const modelName = request.modelId ?? options.defaultModelId
  const languageCode =
    request.languageCode ?? options.defaultLanguageCode ?? DEFAULT_LANGUAGE_CODE

  const input: Record<string, unknown> = {
    text: request.text,
  }
  if (request.prompt) {
    input.prompt = request.prompt
  }

  const voice: Record<string, unknown> = {
    languageCode,
  }
  if (voiceName) {
    voice.name = voiceName
  }
  if (modelName) {
    voice.modelName = modelName
  }

  const synthesizeRequest: Record<string, unknown> = {
    input,
    voice,
    audioConfig: {
      audioEncoding: audioConfig.audioEncoding,
    },
  }

  const audioConfigRequest = synthesizeRequest.audioConfig as Record<
    string,
    unknown
  >
  if (audioConfig.sampleRateHertz) {
    audioConfigRequest.sampleRateHertz = audioConfig.sampleRateHertz
  }

  if (options.projectId && options.location) {
    synthesizeRequest.parent = `projects/${options.projectId}/locations/${options.location}`
  }

  return {
    synthesizeRequest,
    audioConfig,
    modelName,
  }
}

export const createGoogleCloudTtsProvider = (
  options: CreateGoogleCloudTtsProviderOptions = {},
): TtsProvider => ({
  name: 'google_cloud_tts',
  capabilities: {
    streaming: false,
    promptControl: true,
  },
  synthesize: async (request) => {
    const client = await createGoogleCloudClient(options)
    const { synthesizeRequest, audioConfig, modelName } =
      buildSynthesizeRequest(request, {
        ...options,
        defaultOutputFormat:
          options.defaultOutputFormat ?? DEFAULT_OUTPUT_FORMAT,
      })

    let response: { audioContent?: string | Uint8Array } | undefined
    try {
      ;[response] = await client.synthesizeSpeech(synthesizeRequest)
    } catch (error) {
      throw new TtsError({
        code: 'TTS_REQUEST_FAILED',
        provider: 'google_cloud_tts',
        message:
          error instanceof Error
            ? error.message
            : 'Google Cloud TTS request failed.',
        cause: error,
      })
    }

    if (!response) {
      throw new TtsError({
        code: 'TTS_REQUEST_FAILED',
        provider: 'google_cloud_tts',
        message: 'Google Cloud TTS response was empty.',
      })
    }

    return {
      audio: toBytes(response.audioContent),
      mimeType: audioConfig.mimeType,
      provider: 'google_cloud_tts',
      modelId: modelName,
      sampleRateHertz: audioConfig.sampleRateHertz,
    }
  },
})
