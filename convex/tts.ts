'use node'

import { ConvexError, v } from 'convex/values'
import { TtsError } from 'ts-common/speech/tts'
import { createTtsRuntimeFromEnv } from 'ts-common/speech/tts/config'
import { createTtsTextPreprocessor } from '../shared/tts-text-preprocessor'
import { action } from './_generated/server'
import { createCostRuntime } from './costs'
import type { TtsTextPreprocessor } from '../shared/tts-text-preprocessor'
import type { ActionCtx } from './_generated/server'
import type { TtsProviderName } from 'ts-common/speech/tts'
import type { ToolUsageCostService } from './costs/toolUsageCostService'

const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const bytesToBase64 = (bytes: Uint8Array) => {
  let output = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c

    output += BASE64_CHARS[(triple >> 18) & 0x3f]
    output += BASE64_CHARS[(triple >> 12) & 0x3f]
    output += i + 1 < bytes.length ? BASE64_CHARS[(triple >> 6) & 0x3f] : '='
    output += i + 2 < bytes.length ? BASE64_CHARS[triple & 0x3f] : '='
  }
  return output
}

const createRuntime = (requestedProvider?: TtsProviderName) => {
  return createTtsRuntimeFromEnv({
    env: process.env,
    requestedProvider,
    defaults: {
      outputFormat: DEFAULT_OUTPUT_FORMAT,
    },
  })
}

const toConvexError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof TtsError) {
    return new ConvexError({
      code: error.code,
      message: error.message,
    })
  }

  return new ConvexError({
    code: 'TTS_REQUEST_FAILED',
    message: error instanceof Error ? error.message : fallbackMessage,
  })
}

type SynthesizeDeps = {
  toolUsageCostService?: ToolUsageCostService
  preprocessor?: TtsTextPreprocessor
}

const DEFAULT_TTS_TEXT_PREPROCESSOR = createTtsTextPreprocessor()

export const createSynthesizeHandler =
  (deps: SynthesizeDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      text: string
      provider?: TtsProviderName
      voiceId?: string
      modelId?: string
      languageCode?: string
      outputFormat?: string
      sampleRateHertz?: number
      prompt?: string
      optimizeStreamingLatency?: number
    },
  ) => {
    const toolUsageCostService =
      deps.toolUsageCostService ?? createCostRuntime().toolUsageCostService
    const preprocessor = deps.preprocessor ?? DEFAULT_TTS_TEXT_PREPROCESSOR
    const preprocessingResult = preprocessor(args.text)
    if (!preprocessingResult.ok) {
      throw new ConvexError({
        code: 'TTS_TEXT_EMPTY',
        message: 'Text contains no speakable content after preprocessing.',
      })
    }
    const preprocessedText = preprocessingResult.text
    try {
      const runtime = createRuntime(args.provider)
      const response = await runtime.synthesize({
        text: preprocessedText,
        provider: args.provider,
        voiceId: args.voiceId,
        modelId: args.modelId,
        languageCode: args.languageCode,
        outputFormat: args.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
        sampleRateHertz: args.sampleRateHertz,
        prompt: args.prompt,
        optimizeStreamingLatency: args.optimizeStreamingLatency,
      })

      try {
        await toolUsageCostService.recordTtsCost(ctx, {
          operation: 'tts-synthesize',
          threadId: 'tts',
          providerName: response.provider ?? args.provider,
          modelId: response.modelId ?? args.modelId ?? 'default',
          text: preprocessedText,
        })
      } catch (costError) {
        console.error('Failed to record TTS cost', costError)
      }

      return {
        audioBase64: bytesToBase64(response.audio),
        mimeType: response.mimeType,
      }
    } catch (err) {
      try {
        await toolUsageCostService.recordTtsCost(ctx, {
          operation: 'tts-synthesize',
          threadId: 'tts',
          providerName: args.provider,
          modelId: args.modelId ?? 'default',
          text: preprocessedText,
          metadata: {
            status: 'error',
          },
        })
      } catch (costError) {
        console.error('Failed to record TTS cost', costError)
      }
      throw toConvexError(err, 'TTS request failed.')
    }
  }

export const synthesize = action({
  args: {
    text: v.string(),
    provider: v.optional(
      v.union(
        v.literal('elevenlabs'),
        v.literal('google_cloud_tts'),
        v.literal('vertex_gemini_tts'),
      ),
    ),
    voiceId: v.optional(v.string()),
    modelId: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    outputFormat: v.optional(v.string()),
    sampleRateHertz: v.optional(v.number()),
    prompt: v.optional(v.string()),
    optimizeStreamingLatency: v.optional(v.number()),
  },
  handler: createSynthesizeHandler(),
})
