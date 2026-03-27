import { TtsError } from '../errors'
import type { TtsProviderName } from '../types'

const PROVIDER_ALIASES: Record<string, TtsProviderName> = {
  elevenlabs: 'elevenlabs',
  eleven: 'elevenlabs',
  google: 'google_cloud_tts',
  google_cloud_tts: 'google_cloud_tts',
  google_cloud: 'google_cloud_tts',
  vertex: 'vertex_gemini_tts',
  vertex_gemini_tts: 'vertex_gemini_tts',
}

const normalizeProviderName = (
  value: string | undefined,
): TtsProviderName | undefined => {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  return PROVIDER_ALIASES[normalized]
}

export const parseTtsProviderName = (
  value: string | undefined,
): TtsProviderName | undefined => normalizeProviderName(value)

export const resolveTtsProvider = (args: {
  requestedProvider?: TtsProviderName
  env?: NodeJS.ProcessEnv
  defaultProvider?: TtsProviderName
}): TtsProviderName => {
  if (args.requestedProvider) {
    return args.requestedProvider
  }

  const env = args.env ?? process.env
  const envProvider = normalizeProviderName(env.TTS_PROVIDER)
  if (envProvider) {
    return envProvider
  }

  return args.defaultProvider ?? 'elevenlabs'
}

export type ElevenLabsTtsConfig = {
  apiKey: string
  voiceId?: string
  modelId?: string
  outputFormat?: string
}

export const resolveElevenLabsTtsConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ElevenLabsTtsConfig => {
  const apiKey = env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'elevenlabs',
      message: 'Missing ELEVENLABS_API_KEY environment variable',
    })
  }

  return {
    apiKey,
    voiceId: env.ELEVENLABS_VOICE_ID,
    modelId: env.ELEVENLABS_MODEL_ID,
    outputFormat: env.ELEVENLABS_OUTPUT_FORMAT,
  }
}

export type GoogleCloudTtsConfig = {
  projectId?: string
  location?: string
  voiceId?: string
  modelId?: string
  languageCode?: string
  outputFormat?: string
  serviceAccountJson?: string
  serviceAccountJsonBase64?: string
}

export const resolveGoogleCloudTtsConfig = (
  env: NodeJS.ProcessEnv = process.env,
): GoogleCloudTtsConfig => ({
  projectId: env.GOOGLE_CLOUD_PROJECT,
  location: env.GOOGLE_CLOUD_REGION ?? env.GOOGLE_CLOUD_LOCATION,
  voiceId: env.GOOGLE_CLOUD_TTS_VOICE_ID,
  modelId: env.GOOGLE_CLOUD_TTS_MODEL_ID,
  languageCode: env.GOOGLE_CLOUD_TTS_LANGUAGE_CODE,
  outputFormat: env.GOOGLE_CLOUD_TTS_OUTPUT_FORMAT,
  serviceAccountJson: env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON,
  serviceAccountJsonBase64: env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON_BASE64,
})

export const resolveVertexGeminiTtsEnabled = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const raw = env.GOOGLE_GENAI_USE_VERTEXAI
  return raw?.trim().toLowerCase() === 'true'
}

export const resolveFallbackTtsProviders = (
  env: NodeJS.ProcessEnv = process.env,
): Array<TtsProviderName> => {
  const raw = env.TTS_FALLBACK_PROVIDERS
  if (!raw) {
    return []
  }

  const candidates = raw
    .split(',')
    .map((item) => normalizeProviderName(item))
    .filter((item): item is TtsProviderName => Boolean(item))

  return Array.from(new Set(candidates))
}
