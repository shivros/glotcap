import { createOpenAiStreamClient } from './openai'
import { createOpenRouterStreamClient } from './openrouter'
import type { ChatMessage, LlmUsage } from './types'

export type SummaryProvider = 'openai' | 'openrouter' | 'stub'

export type SummaryConfig = {
  provider: SummaryProvider
  model: string
  apiKey?: string
  baseUrl?: string
  appName?: string
  siteUrl?: string
}

type SummarizeTextInput = {
  title?: string
  text: string
  providerConfig?: SummaryConfig
  temperature?: number
  maxTokens?: number
}

type GenerateTextInput = {
  messages: Array<ChatMessage>
  providerConfig?: SummaryConfig
  temperature?: number
  maxTokens?: number
}

export type GenerateTextResult = {
  text: string
  provider: SummaryProvider
  model: string
  usage?: LlmUsage
}

const MAX_STUB_LENGTH = 240

const resolveEnv = () => process.env

const normalizeProvider = (value?: string | null) =>
  value ? value.trim().toLowerCase() : ''

const resolveProvider = (
  explicit: string,
  hasOpenRouterKey: boolean,
  hasOpenAiKey: boolean,
): SummaryProvider => {
  if (explicit === 'openrouter') {
    return hasOpenRouterKey ? 'openrouter' : 'stub'
  }
  if (explicit === 'openai') {
    return hasOpenAiKey ? 'openai' : 'stub'
  }
  if (explicit === 'stub') {
    return 'stub'
  }
  if (hasOpenRouterKey) {
    return 'openrouter'
  }
  if (hasOpenAiKey) {
    return 'openai'
  }
  return 'stub'
}

export const resolveSummaryConfigFromEnv = (): SummaryConfig => {
  const env = resolveEnv()
  const explicit = normalizeProvider(env.COCLERK_SUMMARY_PROVIDER)
  const openRouterKey = env.OPENROUTER_API_KEY
  const openAiKey = env.OPENAI_API_KEY
  const provider = resolveProvider(
    explicit,
    Boolean(openRouterKey),
    Boolean(openAiKey),
  )
  const model =
    provider === 'openrouter'
      ? (env.COCLERK_SUMMARY_MODEL ?? env.OPENROUTER_MODEL ?? 'openrouter/auto')
      : provider === 'openai'
        ? (env.COCLERK_SUMMARY_MODEL ?? 'gpt-4o-mini')
        : 'stub'
  return {
    provider,
    model,
    apiKey:
      provider === 'openrouter'
        ? openRouterKey
        : provider === 'openai'
          ? openAiKey
          : undefined,
    baseUrl: env.OPENROUTER_BASE_URL,
    appName:
      env.OPENROUTER_APP_NAME ??
      env.APP_NAME ??
      env.VITE_APP_NAME ??
      env.APP_TITLE,
    siteUrl:
      env.OPENROUTER_SITE_URL ??
      env.APP_URL ??
      env.SITE_URL ??
      env.VITE_SITE_URL,
  }
}

export const buildSummaryStub = (input: string, title?: string) => {
  const trimmed = input.trim()
  if (!trimmed) {
    return title ? `Summary: ${title}` : ''
  }
  return trimmed.length > MAX_STUB_LENGTH
    ? `${trimmed.slice(0, MAX_STUB_LENGTH)}...`
    : trimmed
}

const buildSummaryMessages = (
  input: SummarizeTextInput,
): Array<ChatMessage> => {
  const title = input.title?.trim()
  const body = input.text.trim()
  const content = title ? `Title: ${title}\n\n${body}` : body
  return [
    {
      role: 'system',
      content:
        'Summarize the following article in 2-3 sentences. Respond with plain text.',
    },
    { role: 'user', content },
  ]
}

export const summarizeText = async (
  input: SummarizeTextInput,
): Promise<string> => {
  const result = await summarizeTextWithUsage(input)
  return result.text
}

export const summarizeTextWithUsage = async (
  input: SummarizeTextInput,
): Promise<GenerateTextResult> => {
  const text = input.text.trim()
  if (!text) {
    return {
      text: '',
      provider: input.providerConfig?.provider ?? 'stub',
      model: input.providerConfig?.model ?? 'stub',
    }
  }
  return generateTextWithUsage({
    messages: buildSummaryMessages(input),
    providerConfig: input.providerConfig,
    temperature: input.temperature ?? 0.3,
    maxTokens: input.maxTokens ?? 220,
  })
}

export const generateText = async (
  input: GenerateTextInput,
): Promise<string> => {
  const result = await generateTextWithUsage(input)
  return result.text
}

export const generateTextWithUsage = async (
  input: GenerateTextInput,
): Promise<GenerateTextResult> => {
  const messages = input.messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
  if (!messages.length) {
    return {
      text: '',
      provider: input.providerConfig?.provider ?? 'stub',
      model: input.providerConfig?.model ?? 'stub',
    }
  }
  const config = input.providerConfig ?? resolveSummaryConfigFromEnv()
  if (config.provider === 'stub') {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user')
    return {
      text: buildSummaryStub(lastUserMessage?.content ?? ''),
      provider: 'stub',
      model: config.model,
    }
  }
  if (!config.apiKey) {
    throw new Error(`Missing ${config.provider} API key`)
  }
  const request = {
    messages,
    temperature: input.temperature ?? 0.3,
    maxTokens: input.maxTokens ?? 220,
    model: config.model,
  }
  const client =
    config.provider === 'openrouter'
      ? createOpenRouterStreamClient({
          apiKey: config.apiKey,
          defaultModel: config.model,
          baseUrl: config.baseUrl,
          siteUrl: config.siteUrl,
          appName: config.appName,
        })
      : createOpenAiStreamClient({
          apiKey: config.apiKey,
          defaultModel: config.model,
        })

  if (client.complete) {
    const completion = await client.complete(request)
    return {
      text: completion.text.trim(),
      usage: completion.usage,
      model: completion.model ?? config.model,
      provider: config.provider,
    }
  }

  let output = ''
  for await (const chunk of client.stream(request)) {
    output += chunk
  }
  return {
    text: output.trim(),
    provider: config.provider,
    model: config.model,
  }
}
