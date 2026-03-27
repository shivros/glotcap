import type { LlmClientConfig, LlmProvider } from './factory'

type ResolveLlmConfigDefaults = {
  model?: string
  appName?: string
}

const detectProvider = (env: NodeJS.ProcessEnv): LlmProvider | null => {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase()
  if (explicit === 'openrouter' || explicit === 'openai') {
    return explicit
  }
  if (env.OPENROUTER_API_KEY?.trim()) {
    return 'openrouter'
  }
  if (env.OPENAI_API_KEY?.trim()) {
    return 'openai'
  }
  return null
}

const resolveApiKey = (
  env: NodeJS.ProcessEnv,
  provider: LlmProvider,
): string => {
  const key =
    provider === 'openrouter'
      ? env.OPENROUTER_API_KEY?.trim()
      : env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new Error(`Missing API key for LLM provider "${provider}".`)
  }
  return key
}

const resolveModel = (
  env: NodeJS.ProcessEnv,
  provider: LlmProvider,
  defaultModel?: string,
): string | undefined => {
  if (defaultModel) {
    return defaultModel
  }
  if (provider === 'openrouter') {
    return env.OPENROUTER_MODEL?.trim() || 'openrouter/auto'
  }
  return env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
}

export const resolveLlmConfigFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
  defaults?: ResolveLlmConfigDefaults,
): LlmClientConfig => {
  const provider = detectProvider(env)
  if (!provider) {
    throw new Error(
      'Cannot resolve LLM provider. Set LLM_PROVIDER or provide OPENROUTER_API_KEY / OPENAI_API_KEY.',
    )
  }

  return {
    provider,
    apiKey: resolveApiKey(env, provider),
    model: resolveModel(env, provider, defaults?.model),
    baseUrl: env.OPENROUTER_BASE_URL?.trim() || undefined,
    appName:
      defaults?.appName ??
      env.OPENROUTER_APP_NAME?.trim() ??
      env.APP_NAME?.trim() ??
      undefined,
    siteUrl:
      env.OPENROUTER_SITE_URL?.trim() ??
      env.APP_URL?.trim() ??
      env.SITE_URL?.trim() ??
      undefined,
  }
}
