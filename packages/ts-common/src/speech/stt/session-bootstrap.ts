import { ConvexError } from 'convex/values'
import type { DeepgramSttConfig } from './deepgram'
import type { SonioxSttConfig } from './soniox'
import type { SttProviderName } from './types'

export type { SttProviderName } from './types'

const DEFAULT_SONIOX_ENDPOINT = 'wss://stt-rt.soniox.com/transcribe-websocket'
const DEFAULT_SONIOX_MODEL = 'stt-rt-preview-v2'
const DEFAULT_SONIOX_TTL_SECONDS = 60
const SONIOX_TEMP_KEY_URL = 'https://api.soniox.com/v1/auth/temporary-api-key'

const DEFAULT_DEEPGRAM_ENDPOINT = 'wss://api.deepgram.com/v1/listen'
const DEFAULT_DEEPGRAM_MODEL = 'nova-3'
const DEFAULT_DEEPGRAM_TTL_SECONDS = 60
const DEEPGRAM_TOKEN_URL = 'https://api.deepgram.com/v1/auth/grant'

export type SonioxTemporaryKeyResponse = {
  api_key?: string
  expires_at?: string
  expires_in_seconds?: number
}

export type DeepgramTemporaryTokenResponse = {
  access_token?: string
  expires_at?: string
  expires_in?: number
}

export type SonioxRuntimeSttConfig = SonioxSttConfig & {
  expiresAt: number | null
}

export type DeepgramRuntimeSttConfig = DeepgramSttConfig & {
  expiresAt: number | null
}

export type RuntimeSttConfig = SonioxRuntimeSttConfig | DeepgramRuntimeSttConfig

export type CreateSonioxSessionBootstrapperOptions = {
  endpoint?: string
  defaultModel?: string
  defaultTtlSeconds?: number
  env?: NodeJS.ProcessEnv
  now?: () => number
  fetchImpl?: typeof fetch
}

export type BuildSonioxSttSessionArgs = {
  sampleRate: number
  sessionReferenceId: string
  language?: string
  model?: string
  ttlSeconds?: number
}

export type CreateDeepgramSessionBootstrapperOptions = {
  endpoint?: string
  defaultModel?: string
  defaultTtlSeconds?: number
  env?: NodeJS.ProcessEnv
  now?: () => number
  fetchImpl?: typeof fetch
}

export type BuildDeepgramSttSessionArgs = {
  sampleRate: number
  sessionReferenceId: string
  language?: string
  model?: string
  ttlSeconds?: number
}

const parseRequiredEnv = (
  key: string,
  env: NodeJS.ProcessEnv,
  messagePrefix = 'Missing',
) => {
  const value = env[key]
  if (!value) {
    throw new ConvexError({
      code: 'STT_CONFIG_MISSING',
      message: `${messagePrefix} ${key} environment variable`,
    })
  }
  return value
}

const parseDeepgramEndpointing = (
  value: string | undefined,
): boolean | number | undefined => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }

  const numeric = Number(normalized)
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric
  }

  return undefined
}

export const resolveSttProvider = (args: {
  requestedProvider?: SttProviderName
  env?: NodeJS.ProcessEnv
  defaultProvider?: SttProviderName
}): SttProviderName => {
  if (args.requestedProvider) {
    return args.requestedProvider
  }

  const env = args.env ?? process.env
  const defaultProvider = args.defaultProvider ?? 'soniox'
  const configuredProvider = env.STT_PROVIDER?.trim().toLowerCase()

  if (configuredProvider === 'soniox' || configuredProvider === 'deepgram') {
    return configuredProvider
  }

  return defaultProvider
}

export const createSonioxTemporaryKey = async ({
  apiKey,
  ttlSeconds,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  apiKey: string
  ttlSeconds: number
  fetchImpl?: typeof fetch
  now?: () => number
}) => {
  const response = await fetchImpl(SONIOX_TEMP_KEY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      usage_type: 'transcribe_websocket',
      expires_in_seconds: ttlSeconds,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ConvexError({
      code: 'STT_TOKEN_FAILED',
      message: `Soniox temporary key request failed: ${errorText}`,
    })
  }

  const data = (await response.json()) as SonioxTemporaryKeyResponse
  const key = data.api_key

  if (!key) {
    throw new ConvexError({
      code: 'STT_TOKEN_FAILED',
      message: 'Soniox temporary key response missing api_key',
    })
  }

  return {
    apiKey: key,
    expiresAt: data.expires_at
      ? Date.parse(data.expires_at)
      : data.expires_in_seconds
        ? now() + data.expires_in_seconds * 1000
        : null,
  }
}

export const createDeepgramTemporaryToken = async ({
  apiKey,
  ttlSeconds,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  apiKey: string
  ttlSeconds: number
  fetchImpl?: typeof fetch
  now?: () => number
}) => {
  const response = await fetchImpl(DEEPGRAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ttl_seconds: ttlSeconds,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ConvexError({
      code: 'STT_TOKEN_FAILED',
      message: `Deepgram token request failed: ${errorText}`,
    })
  }

  const data = (await response.json()) as DeepgramTemporaryTokenResponse
  const token = data.access_token

  if (!token) {
    throw new ConvexError({
      code: 'STT_TOKEN_FAILED',
      message: 'Deepgram token response missing access_token',
    })
  }

  return {
    accessToken: token,
    expiresAt: data.expires_at
      ? Date.parse(data.expires_at)
      : data.expires_in
        ? now() + data.expires_in * 1000
        : null,
  }
}

export const createSonioxSttSessionBootstrapper = ({
  endpoint = DEFAULT_SONIOX_ENDPOINT,
  defaultModel = DEFAULT_SONIOX_MODEL,
  defaultTtlSeconds = DEFAULT_SONIOX_TTL_SECONDS,
  env = process.env,
  now = () => Date.now(),
  fetchImpl = fetch,
}: CreateSonioxSessionBootstrapperOptions = {}) => {
  const sonioxApiKey = parseRequiredEnv('SONIOX_API_KEY', env)

  return async ({
    sampleRate,
    sessionReferenceId,
    language,
    model,
    ttlSeconds,
  }: BuildSonioxSttSessionArgs): Promise<SonioxRuntimeSttConfig> => {
    const configuredTtl = Number(
      ttlSeconds ?? env.SONIOX_TEMP_KEY_TTL_SECONDS ?? defaultTtlSeconds,
    )
    const { apiKey, expiresAt } = await createSonioxTemporaryKey({
      apiKey: sonioxApiKey,
      ttlSeconds: Number.isFinite(configuredTtl)
        ? configuredTtl
        : defaultTtlSeconds,
      fetchImpl,
      now,
    })

    const resolvedModel = model ?? env.SONIOX_STT_MODEL ?? defaultModel
    const languageHints = language ? [language] : undefined

    return {
      provider: 'soniox',
      url: endpoint,
      config: {
        api_key: apiKey,
        model: resolvedModel,
        audio_format: 'pcm_s16le',
        sample_rate: sampleRate,
        num_channels: 1,
        language_hints: languageHints,
        enable_endpoint_detection: true,
        client_reference_id: sessionReferenceId,
      },
      expiresAt,
    }
  }
}

export const createDeepgramSttSessionBootstrapper = ({
  endpoint = DEFAULT_DEEPGRAM_ENDPOINT,
  defaultModel = DEFAULT_DEEPGRAM_MODEL,
  defaultTtlSeconds = DEFAULT_DEEPGRAM_TTL_SECONDS,
  env = process.env,
  now = () => Date.now(),
  fetchImpl = fetch,
}: CreateDeepgramSessionBootstrapperOptions = {}) => {
  const deepgramApiKey = parseRequiredEnv('DEEPGRAM_API_KEY', env)

  return async ({
    sampleRate,
    language,
    model,
    ttlSeconds,
  }: BuildDeepgramSttSessionArgs): Promise<DeepgramRuntimeSttConfig> => {
    const configuredTtl = Number(
      ttlSeconds ?? env.DEEPGRAM_TEMP_TOKEN_TTL_SECONDS ?? defaultTtlSeconds,
    )
    const { accessToken, expiresAt } = await createDeepgramTemporaryToken({
      apiKey: deepgramApiKey,
      ttlSeconds: Number.isFinite(configuredTtl)
        ? configuredTtl
        : defaultTtlSeconds,
      fetchImpl,
      now,
    })

    const resolvedModel = model ?? env.DEEPGRAM_STT_MODEL ?? defaultModel
    const endpointing = parseDeepgramEndpointing(env.DEEPGRAM_STT_ENDPOINTING)

    return {
      provider: 'deepgram',
      url: endpoint,
      config: {
        access_token: accessToken,
        model: resolvedModel,
        language,
        encoding: 'linear16',
        sample_rate: sampleRate,
        channels: 1,
        interim_results: true,
        punctuate: true,
        smart_format: true,
        endpointing,
      },
      expiresAt,
    }
  }
}
