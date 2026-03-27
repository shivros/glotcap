import { TtsError } from '../errors'
import { createTtsRegistry } from '../registry'
import { createTtsRuntime } from '../runtime'
import {
  createElevenLabsTtsProvider,
  createGoogleCloudTtsProvider,
  createVertexGeminiTtsProvider,
} from '../providers'
import {
  resolveFallbackTtsProviders,
  resolveGoogleCloudTtsConfig,
  resolveTtsProvider,
  resolveVertexGeminiTtsEnabled,
} from './resolve-tts-config'
import type { TtsProvider, TtsProviderName } from '../types'

type ProviderOverrides = Partial<Record<TtsProviderName, TtsProvider>>

export type CreateTtsRuntimeFromEnvOptions = {
  env?: NodeJS.ProcessEnv
  requestedProvider?: TtsProviderName
  defaultProvider?: TtsProviderName
  fallbackProviders?: Array<TtsProviderName>
  providers?: ProviderOverrides
  defaults?: {
    elevenlabsModelId?: string
    vertexModelId?: string
    outputFormat?: string
  }
}

const DEFAULT_ELEVEN_MODEL = 'eleven_multilingual_v2'
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash-preview-tts'
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128'

type GoogleServiceAccountCredentials = {
  client_email: string
  private_key: string
}

const parseGoogleServiceAccountCredentials = (args: {
  serviceAccountJson?: string
  serviceAccountJsonBase64?: string
}): GoogleServiceAccountCredentials | undefined => {
  const raw =
    args.serviceAccountJson ??
    (args.serviceAccountJsonBase64
      ? Buffer.from(args.serviceAccountJsonBase64, 'base64').toString('utf8')
      : undefined)

  if (!raw) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'google_cloud_tts',
      message:
        'Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON(_BASE64): expected valid JSON service account key.',
      cause: error,
    })
  }

  const record = parsed as Record<string, unknown>
  const clientEmail = record.client_email
  const privateKey = record.private_key

  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new TtsError({
      code: 'TTS_CONFIG_MISSING',
      provider: 'google_cloud_tts',
      message:
        'GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON(_BASE64) is missing client_email/private_key.',
    })
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
  }
}

export const createTtsRuntimeFromEnv = (
  options: CreateTtsRuntimeFromEnvOptions = {},
) => {
  const env = options.env ?? process.env
  const providers: Array<TtsProvider> = []
  const overrides = options.providers ?? {}
  const defaults = options.defaults ?? {}

  if (overrides.elevenlabs) {
    providers.push(overrides.elevenlabs)
  } else if (env.ELEVENLABS_API_KEY) {
    providers.push(
      createElevenLabsTtsProvider({
        apiKey: env.ELEVENLABS_API_KEY,
        defaultVoiceId: env.ELEVENLABS_VOICE_ID,
        defaultModelId:
          env.ELEVENLABS_MODEL_ID ??
          defaults.elevenlabsModelId ??
          DEFAULT_ELEVEN_MODEL,
        defaultOutputFormat:
          env.ELEVENLABS_OUTPUT_FORMAT ??
          defaults.outputFormat ??
          DEFAULT_OUTPUT_FORMAT,
      }),
    )
  }

  if (overrides.google_cloud_tts) {
    providers.push(overrides.google_cloud_tts)
  } else {
    const googleConfig = resolveGoogleCloudTtsConfig(env)
    const googleCredentials = parseGoogleServiceAccountCredentials({
      serviceAccountJson: googleConfig.serviceAccountJson,
      serviceAccountJsonBase64: googleConfig.serviceAccountJsonBase64,
    })
    providers.push(
      createGoogleCloudTtsProvider({
        projectId: googleConfig.projectId,
        location: googleConfig.location,
        clientOptions: googleCredentials
          ? {
              projectId: googleConfig.projectId,
              credentials: googleCredentials,
            }
          : undefined,
        defaultVoiceId: googleConfig.voiceId,
        defaultModelId: googleConfig.modelId,
        defaultLanguageCode: googleConfig.languageCode,
        defaultOutputFormat:
          googleConfig.outputFormat ??
          defaults.outputFormat ??
          DEFAULT_OUTPUT_FORMAT,
      }),
    )
  }

  if (overrides.vertex_gemini_tts) {
    providers.push(overrides.vertex_gemini_tts)
  } else if (resolveVertexGeminiTtsEnabled(env)) {
    const googleConfig = resolveGoogleCloudTtsConfig(env)
    const googleCredentials = parseGoogleServiceAccountCredentials({
      serviceAccountJson: googleConfig.serviceAccountJson,
      serviceAccountJsonBase64: googleConfig.serviceAccountJsonBase64,
    })
    providers.push(
      createVertexGeminiTtsProvider({
        projectId: googleConfig.projectId,
        location: googleConfig.location,
        googleAuthOptions: googleCredentials
          ? {
              credentials: googleCredentials,
              projectId: googleConfig.projectId,
            }
          : undefined,
        defaultVoiceId: googleConfig.voiceId,
        defaultModelId:
          googleConfig.modelId ??
          defaults.vertexModelId ??
          DEFAULT_VERTEX_MODEL,
      }),
    )
  }

  const registry = createTtsRegistry(providers)
  const inferredDefaultProvider: TtsProviderName = env.ELEVENLABS_API_KEY
    ? 'elevenlabs'
    : 'google_cloud_tts'

  const defaultProvider = resolveTtsProvider({
    requestedProvider: options.requestedProvider,
    env,
    defaultProvider: options.defaultProvider ?? inferredDefaultProvider,
  })

  if (!registry.has(defaultProvider)) {
    throw new TtsError({
      code: 'TTS_PROVIDER_UNAVAILABLE',
      provider: defaultProvider,
      message: `TTS provider "${defaultProvider}" is not configured.`,
    })
  }

  return createTtsRuntime({
    registry,
    defaultProvider,
    fallbackProviders:
      options.fallbackProviders ?? resolveFallbackTtsProviders(env),
  })
}
