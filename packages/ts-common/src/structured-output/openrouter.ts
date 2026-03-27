import { assertStructuredOutput } from './interfaces'
import type {
  StructuredOutputClient,
  StructuredOutputRequest,
  StructuredOutputResult,
} from './interfaces'

type OpenRouterClientConfig = {
  apiKey: string
  defaultModel: string
  baseUrl?: string
  appName?: string
  siteUrl?: string
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Record<string, unknown>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  model?: string
  error?: {
    message?: string
  }
}

export class OpenRouterStructuredOutputClient implements StructuredOutputClient {
  private apiKey: string
  private defaultModel: string
  private baseUrl: string
  private appName?: string
  private siteUrl?: string

  constructor(config: OpenRouterClientConfig) {
    this.apiKey = config.apiKey
    this.defaultModel = config.defaultModel
    this.baseUrl = config.baseUrl ?? 'https://openrouter.ai/api/v1'
    this.appName = config.appName
    this.siteUrl = config.siteUrl
  }

  async generate<T>(
    request: StructuredOutputRequest<T>,
  ): Promise<StructuredOutputResult<T>> {
    if (!this.apiKey) {
      throw new Error('Missing OpenRouter API key')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.appName ? { 'X-Title': this.appName } : {}),
        ...(this.siteUrl ? { 'HTTP-Referer': this.siteUrl } : {}),
      },
      body: JSON.stringify({
        model: request.model ?? this.defaultModel,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens,
        messages: [
          ...(request.system
            ? [{ role: 'system', content: request.system }]
            : []),
          { role: 'user', content: request.prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema: request.schema,
          },
        },
      }),
    })

    const payload = (await response.json()) as OpenRouterResponse
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message ?? 'OpenRouter request failed')
    }

    const messageContent = payload.choices?.[0]?.message?.content
    if (!messageContent) {
      throw new Error('OpenRouter response missing content')
    }

    const parsed =
      typeof messageContent === 'string'
        ? JSON.parse(messageContent)
        : messageContent

    const value = assertStructuredOutput(parsed, request.guard)

    return {
      value,
      raw: parsed,
      model: payload.model ?? request.model ?? this.defaultModel,
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens,
            outputTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    }
  }
}
