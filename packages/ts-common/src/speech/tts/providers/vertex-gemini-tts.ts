import { GoogleGenAI } from '@google/genai'
import { TtsError } from '../errors'
import type { TtsProvider } from '../types'

type CreateVertexGeminiTtsProviderOptions = {
  client?: VertexGeminiClientLike
  projectId?: string
  location?: string
  googleAuthOptions?: Record<string, unknown>
  defaultVoiceId?: string
  defaultModelId?: string
}

type VertexGeminiClientLike = {
  models: {
    generateContent: (
      request: unknown,
    ) => Promise<VertexGeminiGenerateContentResponse>
  }
}

type VertexGeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string
          mimeType?: string
        }
      }>
    }
  }>
}

const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash-preview-tts'
const DEFAULT_VERTEX_VOICE = 'Kore'
const DEFAULT_PCM_SAMPLE_RATE = 24_000
const DEFAULT_PCM_CHANNELS = 1
const WAV_HEADER_BYTES = 44

const parseMimeParamNumber = (mimeType: string, paramName: string) => {
  const match = mimeType.match(new RegExp(`${paramName}=([0-9]+)`, 'i'))
  if (!match) {
    return undefined
  }
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

const isRawPcmMimeType = (mimeType: string) => {
  const lower = mimeType.toLowerCase()
  return lower.startsWith('audio/l16') || lower.startsWith('audio/pcm')
}

const wrapPcm16AsWav = (
  pcm: Uint8Array,
  args?: {
    sampleRateHertz?: number
    channels?: number
  },
) => {
  const sampleRateHertz = args?.sampleRateHertz ?? DEFAULT_PCM_SAMPLE_RATE
  const channels = args?.channels ?? DEFAULT_PCM_CHANNELS
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const byteRate = sampleRateHertz * channels * bytesPerSample
  const blockAlign = channels * bytesPerSample
  const totalLength = WAV_HEADER_BYTES + pcm.byteLength

  const wav = new Uint8Array(totalLength)
  const view = new DataView(wav.buffer)

  // RIFF header
  wav.set([0x52, 0x49, 0x46, 0x46], 0) // "RIFF"
  view.setUint32(4, totalLength - 8, true)
  wav.set([0x57, 0x41, 0x56, 0x45], 8) // "WAVE"

  // fmt chunk
  wav.set([0x66, 0x6d, 0x74, 0x20], 12) // "fmt "
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // AudioFormat = PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRateHertz, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  wav.set([0x64, 0x61, 0x74, 0x61], 36) // "data"
  view.setUint32(40, pcm.byteLength, true)
  wav.set(pcm, WAV_HEADER_BYTES)

  return wav
}

const createVertexClient = async (
  options: CreateVertexGeminiTtsProviderOptions,
) => {
  await Promise.resolve()
  if (options.client) {
    return options.client
  }

  if (!options.projectId || !options.location) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'vertex_gemini_tts',
      message:
        'Vertex Gemini TTS requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_REGION (or GOOGLE_CLOUD_LOCATION).',
    })
  }

  try {
    return new GoogleGenAI({
      vertexai: true,
      project: options.projectId,
      location: options.location,
      googleAuthOptions: options.googleAuthOptions,
    }) as unknown as VertexGeminiClientLike
  } catch (error) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'vertex_gemini_tts',
      message:
        'Vertex Gemini TTS client unavailable. Install @google/genai and configure Vertex AI credentials.',
      cause: error,
    })
  }
}

export const createVertexGeminiTtsProvider = (
  options: CreateVertexGeminiTtsProviderOptions = {},
): TtsProvider => {
  return {
    name: 'vertex_gemini_tts',
    capabilities: {
      streaming: false,
      promptControl: true,
    },
    synthesize: async (request) => {
      const client = await createVertexClient(options)
      const modelId =
        request.modelId ?? options.defaultModelId ?? DEFAULT_VERTEX_MODEL
      const voiceName =
        request.voiceId ?? options.defaultVoiceId ?? DEFAULT_VERTEX_VOICE
      const textPrompt = request.prompt ?? request.text

      let response: VertexGeminiGenerateContentResponse
      try {
        response = await client.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts: [{ text: textPrompt }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        })
      } catch (error) {
        throw new TtsError({
          code: 'TTS_REQUEST_FAILED',
          provider: 'vertex_gemini_tts',
          message:
            error instanceof Error
              ? error.message
              : 'Vertex Gemini TTS request failed.',
          cause: error,
        })
      }

      const inlineAudio = response.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part.inlineData?.data === 'string',
      )?.inlineData

      if (!inlineAudio?.data) {
        throw new TtsError({
          code: 'TTS_REQUEST_FAILED',
          provider: 'vertex_gemini_tts',
          message: 'Vertex Gemini TTS response missing audio data.',
        })
      }

      const base64Audio = new Uint8Array(
        Buffer.from(inlineAudio.data, 'base64'),
      )
      const responseMimeType = inlineAudio.mimeType ?? 'audio/pcm'
      const sampleRateFromMimeType =
        parseMimeParamNumber(responseMimeType, 'rate') ??
        parseMimeParamNumber(responseMimeType, 'samplerate')
      const channelsFromMimeType = parseMimeParamNumber(
        responseMimeType,
        'channels',
      )

      const isRawPcm = isRawPcmMimeType(responseMimeType)
      const audio = isRawPcm
        ? wrapPcm16AsWav(base64Audio, {
            sampleRateHertz: sampleRateFromMimeType,
            channels: channelsFromMimeType,
          })
        : base64Audio

      return {
        audio,
        mimeType: isRawPcm ? 'audio/wav' : responseMimeType,
        provider: 'vertex_gemini_tts',
        modelId,
        sampleRateHertz: request.sampleRateHertz ?? sampleRateFromMimeType,
      }
    },
  }
}
