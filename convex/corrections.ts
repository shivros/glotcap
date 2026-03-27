import {
  buildCorrectionsPrompt,
  buildCorrectionsSystemPrompt,
  correctionsSchema,
  isCorrectionsResult,
  normalizeCorrections,
} from 'ts-common/speech/corrections'
import { createStructuredOutputClient } from 'ts-common/structured-output'
import { ConvexError, v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { requireEnv } from './coach/config'
import { createCostRuntime } from './costs'
import { recordStructuredOutputCostBestEffort } from './costs/structuredOutputCostService'
import type { Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import type { StructuredOutputCostService } from './costs/structuredOutputCostService'

const DEFAULT_CORRECTIONS_TEMPERATURE = 0.2
const MAX_CORRECTIONS = 4

const resolveCorrectionsModel = (override?: string) =>
  override ?? requireEnv('OPENROUTER_CORRECTIONS_MODEL')

const createCorrectionsClient = () =>
  createStructuredOutputClient({
    provider: 'openrouter',
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    defaultModel: resolveCorrectionsModel(),
    siteUrl: process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME,
  })

type AnalyzeTurnDeps = {
  structuredOutputCostService?: StructuredOutputCostService
}

export const createAnalyzeTurnHandler =
  (deps: AnalyzeTurnDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      sessionId: Id<'speakingSessions'>
      text: string
      transcriptEventId?: Id<'speakingEvents'>
      model?: string
      temperature?: number
      maxCorrections?: number
    },
  ) => {
    const structuredOutputCostService =
      deps.structuredOutputCostService ??
      createCostRuntime().structuredOutputCostService

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

    const maxCorrections = Math.max(args.maxCorrections ?? MAX_CORRECTIONS, 0)
    if (!maxCorrections) {
      return { inserted: 0 }
    }

    const system = buildCorrectionsSystemPrompt({
      targetLanguage: session.targetLanguage,
      sourceLanguage: session.sourceLanguage ?? undefined,
      maxCorrections,
    })
    const prompt = buildCorrectionsPrompt({
      text: trimmed,
      targetLanguage: session.targetLanguage,
      sourceLanguage: session.sourceLanguage ?? undefined,
    })

    const client = createCorrectionsClient()
    const resolvedModel = resolveCorrectionsModel(args.model)
    const resolvedTemperature =
      args.temperature ?? DEFAULT_CORRECTIONS_TEMPERATURE

    const result = await client.generate({
      schema: correctionsSchema,
      guard: isCorrectionsResult,
      system,
      prompt,
      model: resolvedModel,
      temperature: resolvedTemperature,
      maxTokens: 700,
    })

    const corrections = normalizeCorrections(result.value.corrections, {
      max: maxCorrections,
    })
    const costRecordArgs = {
      operation: 'speaking-corrections',
      modelId: result.model ?? resolvedModel,
      threadId: `speaking:${args.sessionId}`,
      userId: session.userId,
      usage: result.usage,
    } as const

    if (corrections.length === 0) {
      await recordStructuredOutputCostBestEffort(
        structuredOutputCostService,
        ctx,
        costRecordArgs,
      )
      return { inserted: 0 }
    }

    const provider = result.model ?? resolvedModel

    await ctx.runMutation(internal.corrections.appendCorrections, {
      sessionId: args.sessionId,
      transcriptEventId: args.transcriptEventId,
      provider,
      corrections,
    })
    await recordStructuredOutputCostBestEffort(
      structuredOutputCostService,
      ctx,
      costRecordArgs,
    )

    return { inserted: corrections.length }
  }

export const analyzeTurn = action({
  args: {
    sessionId: v.id('speakingSessions'),
    text: v.string(),
    transcriptEventId: v.optional(v.id('speakingEvents')),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxCorrections: v.optional(v.number()),
  },
  handler: createAnalyzeTurnHandler(),
})

export const appendCorrections = internalMutation({
  args: {
    sessionId: v.id('speakingSessions'),
    transcriptEventId: v.optional(v.id('speakingEvents')),
    provider: v.optional(v.string()),
    corrections: v.array(
      v.object({
        title: v.string(),
        detail: v.string(),
        original: v.string(),
        corrected: v.string(),
        severity: v.union(
          v.literal('low'),
          v.literal('medium'),
          v.literal('high'),
          v.literal('positive'),
        ),
        category: v.string(),
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

    for (const [index, correction] of args.corrections.entries()) {
      await ctx.db.insert('speakingEvents', {
        sessionId: args.sessionId,
        type: 'correction',
        provider: args.provider,
        speaker: 'system',
        text: correction.corrected,
        title: correction.title,
        detail: correction.detail,
        severity: correction.severity,
        payload: correction,
        referenceEventId: transcriptEventId,
        createdAt: baseCreatedAt + index,
      })
    }

    return { inserted: args.corrections.length }
  },
})
