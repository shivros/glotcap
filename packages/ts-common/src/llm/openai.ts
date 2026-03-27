import OpenAI from 'openai'
import type {
  ChatMessage,
  LlmUsage,
  StreamChatCompletionRequest,
  StreamingLlmClient,
} from './types'

type OpenAiStreamClientOptions = {
  apiKey: string
  baseUrl?: string
  defaultModel?: string
}

const normalizeMessages = (messages: Array<ChatMessage>) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

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

export const createOpenAiStreamClient = (
  options: OpenAiStreamClientOptions,
): StreamingLlmClient => {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
  })

  return {
    async *stream(request: StreamChatCompletionRequest) {
      const stream = await client.chat.completions.create({
        model: request.model ?? options.defaultModel ?? 'gpt-4o-mini',
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
      const completion = await client.chat.completions.create({
        model: request.model ?? options.defaultModel ?? 'gpt-4o-mini',
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
