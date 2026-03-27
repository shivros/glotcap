import { OpenRouterStructuredOutputClient } from './openrouter'
import type { StructuredOutputClient } from './interfaces'

export type StructuredOutputProvider = 'openrouter' | 'openai' | 'gemini'

export type OpenRouterProviderConfig = {
  provider: 'openrouter'
  apiKey: string
  defaultModel: string
  baseUrl?: string
  appName?: string
  siteUrl?: string
}

export type StructuredOutputClientConfig =
  | OpenRouterProviderConfig
  | { provider: 'openai' | 'gemini' }

export const createStructuredOutputClient = (
  config: StructuredOutputClientConfig,
): StructuredOutputClient => {
  if (config.provider === 'openrouter') {
    const { provider: _provider, ...openRouterConfig } = config
    return new OpenRouterStructuredOutputClient(openRouterConfig)
  }

  throw new Error(
    `Structured output provider "${config.provider}" is not configured.`,
  )
}
