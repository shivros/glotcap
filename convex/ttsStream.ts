import { requestElevenLabsSpeechStream } from 'ts-common/speech/tts'
import { parseTtsProviderName } from 'ts-common/speech/tts/config/resolve-tts-config'
import { createTtsTextPreprocessor } from '../shared/tts-text-preprocessor'
import { api } from './_generated/api'
import { httpAction } from './_generated/server'
import { createCostRuntime } from './costs'
import type { TtsTextPreprocessor } from '../shared/tts-text-preprocessor'
import type { TtsProviderName } from 'ts-common/speech/tts'
import type { ActionCtx } from './_generated/server'
import type { ToolUsageCostService } from './costs/toolUsageCostService'

const DEFAULT_ELEVEN_MODEL = 'eleven_multilingual_v2'
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const base64ToBytes = (value: string) => {
  const clean = value.replace(/=+$/, '')
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let byteIndex = 0

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i] ?? 'A')
    const c2 = BASE64_CHARS.indexOf(clean[i + 1] ?? 'A')
    const c3 = BASE64_CHARS.indexOf(clean[i + 2] ?? 'A')
    const c4 = BASE64_CHARS.indexOf(clean[i + 3] ?? 'A')

    const triple = (c1 << 18) | (c2 << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f)

    if (byteIndex < bytes.length) {
      bytes[byteIndex++] = (triple >> 16) & 0xff
    }
    if (byteIndex < bytes.length && i + 2 < clean.length) {
      bytes[byteIndex++] = (triple >> 8) & 0xff
    }
    if (byteIndex < bytes.length && i + 3 < clean.length) {
      bytes[byteIndex++] = triple & 0xff
    }
  }

  return bytes
}

const resolveRequestedProvider = (
  provider: string | undefined,
): TtsProviderName | undefined => parseTtsProviderName(provider)

const resolveDefaultProvider = (): TtsProviderName => {
  const explicit = parseTtsProviderName(process.env.TTS_PROVIDER)
  if (explicit) {
    return explicit
  }
  return process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'google_cloud_tts'
}

const shouldUseElevenLabsStreaming = (provider?: TtsProviderName) => {
  const resolvedProvider = provider ?? resolveDefaultProvider()
  return (
    resolvedProvider === 'elevenlabs' && Boolean(process.env.ELEVENLABS_API_KEY)
  )
}

type StreamRequestBody = {
  text?: string
  provider?: string
  voiceId?: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
  sampleRateHertz?: number
  prompt?: string
  optimizeStreamingLatency?: number
}

type StreamHandlerDeps = {
  preprocessor?: TtsTextPreprocessor
  toolUsageCostService?: ToolUsageCostService
}

const DEFAULT_TTS_TEXT_PREPROCESSOR = createTtsTextPreprocessor()

const streamWithElevenLabs = async (
  ctx: ActionCtx,
  body: StreamRequestBody,
  preprocessedText: string,
  toolUsageCostService: ToolUsageCostService,
) => {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = body.voiceId ?? process.env.ELEVENLABS_VOICE_ID

  if (!apiKey || !voiceId) {
    return new Response('Missing ElevenLabs configuration', { status: 400 })
  }

  try {
    const resolvedModelId =
      body.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_ELEVEN_MODEL
    const response = await requestElevenLabsSpeechStream({
      apiKey,
      voiceId,
      text: preprocessedText,
      modelId: resolvedModelId,
      languageCode: body.languageCode,
      outputFormat: body.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
      optimizeStreamingLatency: body.optimizeStreamingLatency,
    })

    try {
      await toolUsageCostService.recordTtsCost(ctx, {
        operation: 'tts-stream',
        threadId: 'tts',
        providerName: 'elevenlabs',
        modelId: resolvedModelId,
        text: preprocessedText,
      })
    } catch (costError) {
      console.error('Failed to record ElevenLabs streaming cost', costError)
    }

    return new Response(response.stream, {
      headers: new Headers({
        'Content-Type': response.mimeType,
        'Access-Control-Allow-Origin': '*',
        Vary: 'Origin',
      }),
    })
  } catch (error) {
    try {
      await toolUsageCostService.recordTtsCost(ctx, {
        operation: 'tts-stream',
        threadId: 'tts',
        providerName: 'elevenlabs',
        modelId:
          body.modelId ??
          process.env.ELEVENLABS_MODEL_ID ??
          DEFAULT_ELEVEN_MODEL,
        text: preprocessedText,
        metadata: {
          status: 'error',
        },
      })
    } catch (costError) {
      console.error('Failed to record ElevenLabs streaming cost', costError)
    }
    return new Response(
      error instanceof Error ? error.message : 'ElevenLabs streaming failed.',
      { status: 502 },
    )
  }
}

const synthesizeFallback = async (
  ctx: ActionCtx,
  body: StreamRequestBody,
  preprocessedText: string,
  provider?: TtsProviderName,
) => {
  const synthesized = await ctx.runAction(api.tts.synthesize, {
    text: preprocessedText,
    provider,
    voiceId: body.voiceId,
    modelId: body.modelId,
    languageCode: body.languageCode,
    outputFormat: body.outputFormat,
    sampleRateHertz: body.sampleRateHertz,
    prompt: body.prompt,
    optimizeStreamingLatency: body.optimizeStreamingLatency,
  })

  const bytes = base64ToBytes(synthesized.audioBase64)
  const audioStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

  return new Response(audioStream, {
    headers: new Headers({
      'Content-Type': synthesized.mimeType,
      'Access-Control-Allow-Origin': '*',
      Vary: 'Origin',
    }),
  })
}

export const createStreamHandler =
  (deps: StreamHandlerDeps = {}) =>
  async (ctx: ActionCtx, request: Request) => {
    const toolUsageCostService =
      deps.toolUsageCostService ?? createCostRuntime().toolUsageCostService
    const preprocessor = deps.preprocessor ?? DEFAULT_TTS_TEXT_PREPROCESSOR
    const body = (await request.json()) as StreamRequestBody

    if (!body.text) {
      return new Response('Missing text', { status: 400 })
    }
    const preprocessingResult = preprocessor(body.text)
    if (!preprocessingResult.ok) {
      return new Response(
        'Text contains no speakable content after preprocessing.',
        {
          status: 400,
        },
      )
    }
    const preprocessedText = preprocessingResult.text

    const provider = resolveRequestedProvider(body.provider)

    if (shouldUseElevenLabsStreaming(provider)) {
      return streamWithElevenLabs(
        ctx,
        body,
        preprocessedText,
        toolUsageCostService,
      )
    }

    try {
      return await synthesizeFallback(ctx, body, preprocessedText, provider)
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : 'TTS streaming failed.',
        { status: 502 },
      )
    }
  }

export const stream = httpAction(createStreamHandler())
