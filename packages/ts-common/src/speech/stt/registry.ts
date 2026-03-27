import type { DeepgramSttConfig } from './deepgram'
import type { SonioxSttConfig } from './soniox'
import type { RuntimeSttConfig } from './session-bootstrap'
import type {
  BuildSttSessionArgs,
  SttClient,
  SttClientHandlers,
  SttProviderName,
} from './types'

type SttClientConfigByProvider = {
  deepgram:
    | DeepgramSttConfig
    | Extract<RuntimeSttConfig, { provider: 'deepgram' }>
  soniox: SonioxSttConfig | Extract<RuntimeSttConfig, { provider: 'soniox' }>
}

const missingProviderError = (providerName: SttProviderName) =>
  new Error(`STT provider "${providerName}" is not registered.`)

type BivariantFn<TFn extends (...args: Array<any>) => any> = {
  bivarianceHack: TFn
}['bivarianceHack']

export type SttClientProvider<
  TProviderName extends SttProviderName = SttProviderName,
> = {
  name: TProviderName
  createClient: BivariantFn<
    (
      config: SttClientConfigByProvider[TProviderName],
      handlers: SttClientHandlers,
    ) => SttClient
  >
}

export type SttSessionProvider<
  TProviderName extends SttProviderName = SttProviderName,
> = {
  name: TProviderName
  createSession: BivariantFn<
    (args: BuildSttSessionArgs) => Promise<RuntimeSttConfig>
  >
}

export type SttProvider = SttClientProvider & SttSessionProvider

export type SttClientRegistry = {
  get: <TProviderName extends SttProviderName>(
    providerName: TProviderName,
  ) => SttClientProvider<TProviderName>
  has: (providerName: SttProviderName) => boolean
  list: () => Array<SttProviderName>
}

export const createSttClientRegistry = (
  providers: Array<SttClientProvider>,
): SttClientRegistry => {
  const providerMap = new Map<SttProviderName, SttClientProvider>()

  for (const provider of providers) {
    providerMap.set(provider.name, provider)
  }

  return {
    get: (providerName) => {
      const provider = providerMap.get(providerName)
      if (!provider) {
        throw missingProviderError(providerName)
      }
      return provider as unknown as SttClientProvider<typeof providerName>
    },
    has: (providerName) => providerMap.has(providerName),
    list: () => Array.from(providerMap.keys()),
  }
}

export type SttSessionRegistry = {
  get: (providerName: SttProviderName) => SttSessionProvider
  has: (providerName: SttProviderName) => boolean
  list: () => Array<SttProviderName>
}

export const createSttSessionRegistry = (
  providers: Array<SttSessionProvider>,
): SttSessionRegistry => {
  const providerMap = new Map<SttProviderName, SttSessionProvider>()

  for (const provider of providers) {
    providerMap.set(provider.name, provider)
  }

  return {
    get: (providerName) => {
      const provider = providerMap.get(providerName)
      if (!provider) {
        throw missingProviderError(providerName)
      }
      return provider
    },
    has: (providerName) => providerMap.has(providerName),
    list: () => Array.from(providerMap.keys()),
  }
}

// Backward-compatible combined registry for callers that still provide both
// client/session factories through one interface.
export type SttRegistry = {
  get: (providerName: SttProviderName) => SttProvider
  has: (providerName: SttProviderName) => boolean
  list: () => Array<SttProviderName>
}

export const createSttRegistry = (
  providers: Array<SttProvider>,
): SttRegistry => {
  const providerMap = new Map<SttProviderName, SttProvider>()

  for (const provider of providers) {
    providerMap.set(provider.name, provider)
  }

  return {
    get: (providerName) => {
      const provider = providerMap.get(providerName)
      if (!provider) {
        throw missingProviderError(providerName)
      }
      return provider
    },
    has: (providerName) => providerMap.has(providerName),
    list: () => Array.from(providerMap.keys()),
  }
}
