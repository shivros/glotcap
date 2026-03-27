import { createLlmClient } from 'ts-common/llm'
import { requireEnv } from './coach/config'
import type { LlmProvider } from 'ts-common/llm'

export type TranslationReason = 'timer' | 'immediate' | 'force'

export type TranslationRequest = {
  text: string
  targetLanguage: string
  sourceLanguage?: string
  model?: string
}

export type TranslationMessages = Array<{
  role: 'system' | 'user'
  content: string
}>

export type TranslationAttempt = {
  status: 'ok' | 'error'
  text: string
  model: string
  timings: {
    ttftMs?: number
    totalMs: number
    chunkCount: number
  }
  error?: unknown
}

export type TranslationProviderClient = {
  stream: (args: {
    messages: TranslationMessages
    temperature?: number
  }) => AsyncIterable<string>
}

export type TranslationServiceDependencies = {
  resolveModel: (override?: string) => string
  createClient: (model: string) => TranslationProviderClient
  now?: () => number
}

export interface ITranslationService {
  translate: (request: TranslationRequest) => Promise<TranslationAttempt>
}

export const resolveTranslationModel = (override?: string) =>
  override ??
  process.env.OPENROUTER_TRANSLATION_MODEL ??
  process.env.OPENROUTER_COACH_MODEL ??
  requireEnv('OPENROUTER_TRANSLATION_MODEL')

const buildTranslationPrompt = ({
  text,
  sourceLanguage,
  targetLanguage,
}: TranslationRequest) => {
  const source = sourceLanguage
    ? `from ${sourceLanguage}`
    : 'from the source language'

  return [
    `Translate the following text ${source} to ${targetLanguage}.`,
    'Return only the translated text with no commentary.',
    'Do not wrap the output in quotation marks unless the source text is explicitly quoting someone.',
    `Text: """${text}"""`,
  ].join(' ')
}

const buildMessages = (request: TranslationRequest): TranslationMessages => [
  {
    role: 'system',
    content:
      'You are a translation engine. Do not explain, annotate, or transliterate.',
  },
  {
    role: 'user',
    content: buildTranslationPrompt(request),
  },
]

export class TranslationService implements ITranslationService {
  private readonly resolveModel: TranslationServiceDependencies['resolveModel']

  private readonly createClient: TranslationServiceDependencies['createClient']

  private readonly now: () => number

  constructor({
    resolveModel,
    createClient,
    now = () => Date.now(),
  }: TranslationServiceDependencies) {
    this.resolveModel = resolveModel
    this.createClient = createClient
    this.now = now
  }

  async translate(request: TranslationRequest): Promise<TranslationAttempt> {
    const model = this.resolveModel(request.model)
    const client = this.createClient(model)
    const messages = buildMessages(request)

    let output = ''
    let firstChunkAt: number | null = null
    let chunkCount = 0
    let error: unknown
    const requestStartedAt = this.now()
    let requestCompletedAt = requestStartedAt

    try {
      for await (const chunk of client.stream({
        messages,
        temperature: 0.2,
      })) {
        if (firstChunkAt === null) {
          firstChunkAt = this.now()
        }
        chunkCount += 1
        output += chunk
      }
      requestCompletedAt = this.now()
    } catch (err) {
      error = err
      requestCompletedAt = this.now()
    }

    const translatedText = output.trim()

    return {
      status: error ? 'error' : 'ok',
      text: translatedText,
      model,
      timings: {
        ttftMs:
          firstChunkAt === null ? undefined : firstChunkAt - requestStartedAt,
        totalMs: requestCompletedAt - requestStartedAt,
        chunkCount,
      },
      error,
    }
  }
}

export const createTranslationService = (): ITranslationService =>
  new TranslationService({
    resolveModel: resolveTranslationModel,
    createClient: (model) =>
      createLlmClient({
        provider: (process.env.LLM_PROVIDER ?? 'openrouter') as LlmProvider,
        apiKey: requireEnv('OPENROUTER_API_KEY'),
        model,
        siteUrl: process.env.OPENROUTER_SITE_URL,
        appName: process.env.OPENROUTER_APP_NAME,
      }),
  })
