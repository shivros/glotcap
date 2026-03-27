import {
  buildVocabularyPrompt,
  buildVocabularySystemPrompt,
  isVocabularyResult,
  normalizeVocabulary,
  vocabularySchema,
} from 'ts-common/speech/vocabulary'
import { createStructuredOutputClient } from 'ts-common/structured-output'
import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalAction, internalMutation } from './_generated/server'
import { requireEnv } from './coach/config'
import { createCostRuntime } from './costs'
import { recordStructuredOutputCostBestEffort } from './costs/structuredOutputCostService'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import type { StructuredOutputCostService } from './costs/structuredOutputCostService'

const DEFAULT_VOCABULARY_TEMPERATURE = 0.2
const MAX_VOCABULARY = 3

const resolveVocabularyModel = (override?: string) =>
  override ??
  process.env.OPENROUTER_VOCABULARY_MODEL ??
  requireEnv('OPENROUTER_CORRECTIONS_MODEL')

const createVocabularyClient = () =>
  createStructuredOutputClient({
    provider: 'openrouter',
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    defaultModel: resolveVocabularyModel(),
    siteUrl: process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME,
  })

type VocabularyDeps = {
  structuredOutputCostService?: StructuredOutputCostService
}

const resolveStructuredOutputCostService = (deps: VocabularyDeps = {}) =>
  deps.structuredOutputCostService ??
  createCostRuntime().structuredOutputCostService

const extractTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

const buildExcludeSet = (value?: string) => new Set(extractTokens(value ?? ''))

const shouldExcludeWord = (word: string, exclude: Set<string>) => {
  if (!word) {
    return true
  }
  const tokens = extractTokens(word)
  return tokens.some((token) => exclude.has(token))
}

const filterExcluded = (
  vocabulary: Array<{ word: string; definition: string }>,
  exclude: Set<string>,
) => vocabulary.filter((item) => !shouldExcludeWord(item.word, exclude))

export const createAnalyzeTurnHandler =
  (deps: VocabularyDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      sessionId: Id<'speakingSessions'>
      text: string
      transcriptEventId?: Id<'speakingEvents'>
      excludeText?: string
      model?: string
      temperature?: number
      maxVocabulary?: number
    },
  ) => {
    const structuredOutputCostService = resolveStructuredOutputCostService(deps)
    const trimmed = args.text.trim()
    if (!trimmed) {
      return { inserted: 0 }
    }

    const session = await ctx.runQuery(api.speaking.getSession, {
      sessionId: args.sessionId,
    })
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const maxVocabulary = Math.max(args.maxVocabulary ?? MAX_VOCABULARY, 0)
    if (!maxVocabulary) {
      return { inserted: 0 }
    }

    const sourceLanguage = session.sourceLanguage ?? session.targetLanguage
    const excludeText = args.excludeText ?? trimmed

    const system = buildVocabularySystemPrompt({
      targetLanguage: session.targetLanguage,
      sourceLanguage,
      maxVocabulary,
    })
    const prompt = buildVocabularyPrompt({
      text: trimmed,
      targetLanguage: session.targetLanguage,
      sourceLanguage,
      excludeText,
    })

    const client = createVocabularyClient()
    const resolvedModel = resolveVocabularyModel(args.model)
    const resolvedTemperature =
      args.temperature ?? DEFAULT_VOCABULARY_TEMPERATURE

    const result = await client.generate({
      schema: vocabularySchema,
      guard: isVocabularyResult,
      system,
      prompt,
      model: resolvedModel,
      temperature: resolvedTemperature,
      maxTokens: 700,
    })

    const costRecordArgs = {
      operation: 'speaking-vocabulary',
      modelId: result.model ?? resolvedModel,
      threadId: `speaking:${args.sessionId}`,
      userId: session.userId,
      usage: result.usage,
    } as const

    const vocabulary = normalizeVocabulary(result.value.vocabulary, {
      max: maxVocabulary,
    })
    const exclude = buildExcludeSet(excludeText)
    const filtered = filterExcluded(vocabulary, exclude)

    if (filtered.length === 0) {
      await recordStructuredOutputCostBestEffort(
        structuredOutputCostService,
        ctx,
        costRecordArgs,
      )
      return { inserted: 0 }
    }

    const provider = result.model ?? resolvedModel
    await ctx.runMutation(internal.vocabulary.appendVocabulary, {
      sessionId: args.sessionId,
      transcriptEventId: args.transcriptEventId,
      provider,
      vocabulary: filtered,
    })
    await recordStructuredOutputCostBestEffort(
      structuredOutputCostService,
      ctx,
      costRecordArgs,
    )

    return { inserted: filtered.length }
  }

export const analyzeTurn = action({
  args: {
    sessionId: v.id('speakingSessions'),
    text: v.string(),
    transcriptEventId: v.optional(v.id('speakingEvents')),
    excludeText: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxVocabulary: v.optional(v.number()),
  },
  handler: createAnalyzeTurnHandler(),
})

export const createAnalyzeCoachTurnHandler =
  (deps: VocabularyDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      eventId: Id<'speakingEvents'>
      maxVocabulary?: number
    },
  ) => {
    const structuredOutputCostService = resolveStructuredOutputCostService(deps)
    const event = await ctx.runQuery(internal.speaking.getEventById, {
      eventId: args.eventId,
    })
    if (
      !event ||
      event.type !== 'transcript' ||
      (event.speaker !== 'coach' && event.speaker !== 'teacher')
    ) {
      return { inserted: 0 }
    }

    const text = event.text?.trim() ?? ''
    if (!text) {
      return { inserted: 0 }
    }

    const session = await ctx.runQuery(api.speaking.getSession, {
      sessionId: event.sessionId,
    })
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const maxVocabulary = Math.max(args.maxVocabulary ?? MAX_VOCABULARY, 0)
    if (!maxVocabulary) {
      return { inserted: 0 }
    }

    const sourceLanguage = session.sourceLanguage ?? session.targetLanguage
    const userTranscript = event.turnId
      ? await ctx.runQuery(internal.speaking.getUserTranscriptByTurn, {
          sessionId: event.sessionId,
          turnId: event.turnId,
        })
      : null
    const excludeText = userTranscript?.text ?? ''

    const system = buildVocabularySystemPrompt({
      targetLanguage: session.targetLanguage,
      sourceLanguage,
      maxVocabulary,
    })
    const prompt = [
      `Target language: ${session.targetLanguage}.`,
      `Definition language: ${sourceLanguage}.`,
      `Coach response: """${text}"""`,
      excludeText
        ? `Learner utterance (exclude its words): """${excludeText}""".`
        : '',
      'Extract useful vocabulary relevant to the coach response.',
    ]
      .filter((line) => line.length > 0)
      .join('\n')

    const client = createVocabularyClient()
    const resolvedModel = resolveVocabularyModel()
    const resolvedTemperature = DEFAULT_VOCABULARY_TEMPERATURE

    const result = await client.generate({
      schema: vocabularySchema,
      guard: isVocabularyResult,
      system,
      prompt,
      model: resolvedModel,
      temperature: resolvedTemperature,
      maxTokens: 700,
    })

    const costRecordArgs = {
      operation: 'speaking-coach-vocabulary',
      modelId: result.model ?? resolvedModel,
      threadId: `speaking:${event.sessionId}`,
      userId: session.userId,
      usage: result.usage,
    } as const

    const vocabulary = normalizeVocabulary(result.value.vocabulary, {
      max: maxVocabulary,
    })
    const exclude = buildExcludeSet(excludeText)
    const filtered = filterExcluded(vocabulary, exclude)

    if (filtered.length === 0) {
      await recordStructuredOutputCostBestEffort(
        structuredOutputCostService,
        ctx,
        costRecordArgs,
      )
      return { inserted: 0 }
    }

    const provider = result.model ?? resolvedModel
    await ctx.runMutation(internal.vocabulary.appendVocabulary, {
      sessionId: event.sessionId,
      transcriptEventId: args.eventId,
      provider,
      vocabulary: filtered,
    })
    await recordStructuredOutputCostBestEffort(
      structuredOutputCostService,
      ctx,
      costRecordArgs,
    )

    return { inserted: filtered.length }
  }

export const analyzeCoachTurn = internalAction({
  args: {
    eventId: v.id('speakingEvents'),
    maxVocabulary: v.optional(v.number()),
  },
  handler: createAnalyzeCoachTurnHandler(),
})

export const appendVocabulary = internalMutation({
  args: {
    sessionId: v.id('speakingSessions'),
    transcriptEventId: v.optional(v.id('speakingEvents')),
    provider: v.optional(v.string()),
    vocabulary: v.array(
      v.object({
        word: v.string(),
        definition: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    let baseCreatedAt = Date.now()
    const transcriptEventId = args.transcriptEventId
    if (transcriptEventId) {
      const transcriptEvent = await ctx.db.get(transcriptEventId)
      if (
        transcriptEvent &&
        transcriptEvent.sessionId === args.sessionId &&
        transcriptEvent.type === 'transcript'
      ) {
        baseCreatedAt = transcriptEvent.createdAt
      }
    }

    for (const [index, vocab] of args.vocabulary.entries()) {
      await ctx.db.insert('speakingEvents', {
        sessionId: args.sessionId,
        type: 'vocabulary',
        provider: args.provider,
        speaker: 'system',
        text: vocab.word,
        detail: vocab.definition,
        payload: vocab,
        referenceEventId: transcriptEventId,
        createdAt: baseCreatedAt + index,
      })
    }

    return { inserted: args.vocabulary.length }
  },
})
