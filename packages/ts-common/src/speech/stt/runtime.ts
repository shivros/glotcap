import { createDeepgramSttClient } from './deepgram'
import { createSttClientRegistry, createSttSessionRegistry } from './registry'
import { createSonioxSttClient } from './soniox'
import {
  createDeepgramSttSessionBootstrapper,
  createSonioxSttSessionBootstrapper,
  resolveSttProvider,
} from './session-bootstrap'
import type { DeepgramSttConfig } from './deepgram'
import type { SonioxSttConfig } from './soniox'
import type {
  SttClientProvider,
  SttClientRegistry,
  SttSessionProvider,
  SttSessionRegistry,
} from './registry'
import type {
  CreateDeepgramSessionBootstrapperOptions,
  CreateSonioxSessionBootstrapperOptions,
  RuntimeSttConfig,
} from './session-bootstrap'
import type {
  BuildSttSessionArgs,
  SttClient,
  SttClientHandlers,
  SttProviderName,
} from './types'

export type SttClientConfig = SonioxSttConfig | DeepgramSttConfig

export type BuildRuntimeSttSessionArgs = BuildSttSessionArgs & {
  provider?: SttProviderName
}

type SessionProviderOverrides = Partial<
  Record<SttProviderName, SttSessionProvider>
>

export type CreateRuntimeSttBootstrapperOptions = {
  env?: NodeJS.ProcessEnv
  now?: () => number
  fetchImpl?: typeof fetch
  defaultProvider?: SttProviderName
  sessionRegistry?: SttSessionRegistry
  // Backward-compatible alias.
  registry?: SttSessionRegistry
  providers?: SessionProviderOverrides
  soniox?: Omit<
    CreateSonioxSessionBootstrapperOptions,
    'env' | 'now' | 'fetchImpl'
  >
  deepgram?: Omit<
    CreateDeepgramSessionBootstrapperOptions,
    'env' | 'now' | 'fetchImpl'
  >
}

const DEFAULT_STT_CLIENT_PROVIDERS = [
  {
    name: 'deepgram',
    createClient: (config, handlers) =>
      createDeepgramSttClient(config, handlers),
  } satisfies SttClientProvider<'deepgram'>,
  {
    name: 'soniox',
    createClient: (config, handlers) => createSonioxSttClient(config, handlers),
  } satisfies SttClientProvider<'soniox'>,
]

const DEFAULT_STT_CLIENT_REGISTRY: SttClientRegistry = createSttClientRegistry(
  DEFAULT_STT_CLIENT_PROVIDERS as Array<SttClientProvider>,
)

const createDefaultSttSessionRegistry = (
  options: CreateRuntimeSttBootstrapperOptions,
): SttSessionRegistry => {
  let createDeepgramSession: ReturnType<
    typeof createDeepgramSttSessionBootstrapper
  > | null = null
  let createSonioxSession: ReturnType<
    typeof createSonioxSttSessionBootstrapper
  > | null = null

  const defaultProviders: Array<SttSessionProvider> = [
    {
      name: 'deepgram',
      createSession: (args) => {
        if (!createDeepgramSession) {
          createDeepgramSession = createDeepgramSttSessionBootstrapper({
            endpoint: options.deepgram?.endpoint,
            defaultModel: options.deepgram?.defaultModel,
            defaultTtlSeconds: options.deepgram?.defaultTtlSeconds,
            env: options.env,
            now: options.now,
            fetchImpl: options.fetchImpl,
          })
        }
        return createDeepgramSession(args)
      },
    },
    {
      name: 'soniox',
      createSession: (args) => {
        if (!createSonioxSession) {
          createSonioxSession = createSonioxSttSessionBootstrapper({
            endpoint: options.soniox?.endpoint,
            defaultModel: options.soniox?.defaultModel,
            defaultTtlSeconds: options.soniox?.defaultTtlSeconds,
            env: options.env,
            now: options.now,
            fetchImpl: options.fetchImpl,
          })
        }
        return createSonioxSession(args)
      },
    },
  ]

  const overrides = options.providers ?? {}

  return createSttSessionRegistry(
    defaultProviders.map((provider) => overrides[provider.name] ?? provider),
  )
}

const resolveSttSessionRegistry = (
  options: CreateRuntimeSttBootstrapperOptions,
): SttSessionRegistry =>
  options.sessionRegistry ??
  options.registry ??
  createDefaultSttSessionRegistry(options)

const unregisteredProviderError = (providerName: SttProviderName) =>
  new Error(`STT provider "${providerName}" is not registered.`)

export const createSttClient = (
  config: SttClientConfig | RuntimeSttConfig,
  handlers: SttClientHandlers,
  registry: SttClientRegistry = DEFAULT_STT_CLIENT_REGISTRY,
): SttClient => {
  if (config.provider === 'deepgram') {
    if (!registry.has('deepgram')) {
      throw unregisteredProviderError('deepgram')
    }
    return registry.get('deepgram').createClient(config, handlers)
  }

  if (!registry.has('soniox')) {
    throw unregisteredProviderError('soniox')
  }
  return registry.get('soniox').createClient(config, handlers)
}

export const createSttSessionBootstrapper = (
  options: CreateRuntimeSttBootstrapperOptions = {},
) => {
  const registry = resolveSttSessionRegistry(options)

  return async ({
    sampleRate,
    sessionReferenceId,
    language,
    model,
    ttlSeconds,
    provider,
  }: BuildRuntimeSttSessionArgs): Promise<RuntimeSttConfig> => {
    const resolvedProvider = resolveSttProvider({
      requestedProvider: provider,
      env: options.env,
      defaultProvider: options.defaultProvider,
    })

    if (!registry.has(resolvedProvider)) {
      throw unregisteredProviderError(resolvedProvider)
    }

    return registry.get(resolvedProvider).createSession({
      sampleRate,
      sessionReferenceId,
      language,
      model,
      ttlSeconds,
    })
  }
}
