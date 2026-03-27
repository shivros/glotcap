import { TtsError, isTtsError } from './errors'
import type { TtsRegistry } from './registry'
import type {
  TtsProvider,
  TtsProviderName,
  TtsResponse,
  TtsStreamRequest,
  TtsStreamResponse,
  TtsSynthesizeRequest,
} from './types'

export type TtsRuntimeOptions = {
  registry: TtsRegistry
  defaultProvider: TtsProviderName
  fallbackProviders?: Array<TtsProviderName>
}

const toSingleChunkStream = (audio: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(audio)
      controller.close()
    },
  })

const buildCandidateProviders = (
  request: {
    provider?: TtsProviderName
    providerOptions?: { fallbackProviders?: Array<TtsProviderName> }
  },
  runtime: TtsRuntimeOptions,
) => {
  const provider = request.provider ?? runtime.defaultProvider
  const localFallbacks = request.providerOptions?.fallbackProviders ?? []
  const runtimeFallbacks = runtime.fallbackProviders ?? []

  const ordered = [provider, ...localFallbacks, ...runtimeFallbacks]
  const deduped: Array<TtsProviderName> = []
  const seen = new Set<TtsProviderName>()

  for (const candidate of ordered) {
    if (!seen.has(candidate)) {
      deduped.push(candidate)
      seen.add(candidate)
    }
  }

  return deduped
}

const normalizeProviderError = (
  error: unknown,
  provider: TtsProvider,
  context: 'synthesize' | 'stream',
) => {
  if (isTtsError(error)) {
    return error
  }

  const suffix = context === 'stream' ? 'stream' : 'request'
  const message = error instanceof Error ? error.message : String(error)
  return new TtsError({
    code: 'TTS_REQUEST_FAILED',
    provider: provider.name,
    message: `${provider.name} TTS ${suffix} failed: ${message}`,
    cause: error,
  })
}

const resolveProvider = (
  registry: TtsRegistry,
  providerName: TtsProviderName,
) => {
  if (!registry.has(providerName)) {
    throw new TtsError({
      code: 'TTS_PROVIDER_UNAVAILABLE',
      provider: providerName,
      message: `TTS provider "${providerName}" is not registered.`,
    })
  }
  return registry.get(providerName)
}

export const createTtsRuntime = (options: TtsRuntimeOptions) => {
  const synthesize = async (
    request: TtsSynthesizeRequest,
  ): Promise<TtsResponse> => {
    const candidates = buildCandidateProviders(request, options)
    const failures: Array<TtsError> = []

    for (const providerName of candidates) {
      const provider = resolveProvider(options.registry, providerName)
      try {
        const response = await provider.synthesize({
          ...request,
          provider: provider.name,
        })
        return {
          ...response,
          provider: response.provider ?? provider.name,
          modelId: response.modelId ?? request.modelId,
        }
      } catch (error) {
        failures.push(normalizeProviderError(error, provider, 'synthesize'))
      }
    }

    const firstFailure = failures[0]
    if (firstFailure) {
      throw firstFailure
    }

    throw new TtsError({
      code: 'TTS_PROVIDER_MISSING',
      message: 'No TTS provider candidates were available.',
    })
  }

  const stream = async (
    request: TtsStreamRequest,
  ): Promise<TtsStreamResponse> => {
    const candidates = buildCandidateProviders(request, options)
    const failures: Array<TtsError> = []

    for (const providerName of candidates) {
      const provider = resolveProvider(options.registry, providerName)
      try {
        if (provider.stream) {
          const response = await provider.stream({
            ...request,
            provider: provider.name,
          })
          return {
            ...response,
            provider: response.provider ?? provider.name,
            modelId: response.modelId ?? request.modelId,
          }
        }

        const synthesized = await provider.synthesize({
          ...request,
          provider: provider.name,
        })
        return {
          stream: toSingleChunkStream(synthesized.audio),
          mimeType: synthesized.mimeType,
          provider: provider.name,
          modelId: synthesized.modelId ?? request.modelId,
          sampleRateHertz: synthesized.sampleRateHertz,
        }
      } catch (error) {
        failures.push(normalizeProviderError(error, provider, 'stream'))
      }
    }

    const firstFailure = failures[0]
    if (firstFailure) {
      throw firstFailure
    }

    throw new TtsError({
      code: 'TTS_PROVIDER_MISSING',
      message: 'No TTS provider candidates were available.',
    })
  }

  return {
    synthesize,
    stream,
  }
}
