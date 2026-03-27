import type { TtsProvider, TtsProviderName } from './types'

export type TtsRegistry = {
  get: (providerName: TtsProviderName) => TtsProvider
  has: (providerName: TtsProviderName) => boolean
  list: () => Array<TtsProviderName>
}

export const createTtsRegistry = (
  providers: Array<TtsProvider>,
): TtsRegistry => {
  const providerMap = new Map<TtsProviderName, TtsProvider>()

  for (const provider of providers) {
    providerMap.set(provider.name, provider)
  }

  return {
    get: (providerName) => {
      const provider = providerMap.get(providerName)
      if (!provider) {
        throw new Error(`TTS provider "${providerName}" is not registered.`)
      }
      return provider
    },
    has: (providerName) => providerMap.has(providerName),
    list: () => Array.from(providerMap.keys()),
  }
}
