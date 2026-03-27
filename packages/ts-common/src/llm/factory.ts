import { createOpenAiStreamClient } from './openai'
import { createOpenRouterStreamClient } from './openrouter'
import type { StreamingLlmClient } from './types'

export type LlmProvider = 'openrouter' | 'openai'

export type LlmClientConfig = {
  provider: LlmProvider
  apiKey: string
  model?: string
  baseUrl?: string
  /** OpenRouter-specific. Ignored by other providers. */
  siteUrl?: string
  /** OpenRouter-specific. Ignored by other providers. */
  appName?: string
}

export const createLlmClient = (
  config: LlmClientConfig,
): StreamingLlmClient => {
  switch (config.provider) {
    case 'openrouter':
      return createOpenRouterStreamClient({
        apiKey: config.apiKey,
        defaultModel: config.model,
        baseUrl: config.baseUrl,
        siteUrl: config.siteUrl,
        appName: config.appName,
      })
    case 'openai':
      return createOpenAiStreamClient({
        apiKey: config.apiKey,
        defaultModel: config.model,
        baseUrl: config.baseUrl,
      })
    default: {
      const exhaustive: never = config.provider
      throw new Error(`Unsupported LLM provider: ${exhaustive}`)
    }
  }
}
