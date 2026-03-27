import OpenAI from 'openai'
import type {
  ChatMessage,
  LlmUsage,
  StreamChatCompletionRequest,
  StreamingLlmClient,
} from './types'

type OpenRouterStreamClientOptions = {
  apiKey: string
  defaultModel?: string
  siteUrl?: string
  appName?: string
  baseUrl?: string
}

const normalizeMessages = (messages: Array<ChatMessage>) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

const buildHeaders = (options: OpenRouterStreamClientOptions) => {
  const headers: Record<string, string> = {}

  if (options.siteUrl) {
    headers['HTTP-Referer'] = options.siteUrl
  }

  if (options.appName) {
    headers['X-Title'] = options.appName
  }

  return headers
}

const resolveModel = (
  request: StreamChatCompletionRequest,
  options: OpenRouterStreamClientOptions,
) => {
  const model = request.model ?? options.defaultModel
  if (!model) {
    throw new Error('Missing OpenRouter model.')
  }
  return model
}

const normalizeUsage = (
  usage:
    | {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
    | null
    | undefined,
): LlmUsage | undefined => {
  if (!usage) {
    return undefined
  }

  const promptTokens = usage.prompt_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? 0
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

export const createOpenRouterStreamClient = (
  options: OpenRouterStreamClientOptions,
): StreamingLlmClient => {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl ?? 'https://openrouter.ai/api/v1',
    defaultHeaders: buildHeaders(options),
  })

  return {
    async *stream(request: StreamChatCompletionRequest) {
      const stream = await client.chat.completions.create({
        model: resolveModel(request, options),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: normalizeMessages(request.messages),
        stream: true,
      })

      for await (const part of stream) {
        const choice = part.choices[0]
        if (!choice) {
          continue
        }
        const chunk = choice.delta.content ?? ''
        if (chunk) {
          yield chunk
        }
      }
    },
    async complete(request: StreamChatCompletionRequest) {
      const model = resolveModel(request, options)
      const completion = await client.chat.completions.create({
        model,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        messages: normalizeMessages(request.messages),
        stream: false,
      })

      const firstChoice = completion.choices[0]
      if (!firstChoice) {
        throw new Error('LLM response did not include choices.')
      }
      const content =
        typeof firstChoice.message.content === 'string'
          ? firstChoice.message.content
          : ''
      const text = content.trim()
      if (!text) {
        throw new Error('LLM returned an empty response.')
      }

      return {
        text,
        usage: normalizeUsage(completion.usage),
        model: completion.model,
      }
    },
  }
}
