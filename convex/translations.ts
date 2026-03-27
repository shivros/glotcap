import { v } from 'convex/values'
import { api } from './_generated/api'
import { action } from './_generated/server'
import { createTranslationService } from './translation_service'
import { ConvexTranslationTelemetrySink } from './translation_telemetry'
import { createCostRuntime } from './costs'
import type { ActionCtx } from './_generated/server'
import type { ToolUsageCostService } from './costs/toolUsageCostService'

const translationService = createTranslationService()

type TranslationDeps = {
  toolUsageCostService?: ToolUsageCostService
}

export const createTranslateSegmentHandler =
  (deps: TranslationDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      text: string
      targetLanguage: string
      sourceLanguage?: string
      model?: string
      sessionId?: string
      sourceId?: string
      reason?: 'timer' | 'immediate' | 'force'
      revision?: number
    },
  ) => {
    const toolUsageCostService =
      deps.toolUsageCostService ?? createCostRuntime().toolUsageCostService

    const telemetrySink = new ConvexTranslationTelemetrySink((payload) =>
      ctx.runMutation(api.logging.logEvent, payload),
    )

    const attempt = await translationService.translate({
      text: args.text,
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      model: args.model,
    })

    telemetrySink.recordProviderTiming({
      request: {
        text: args.text,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        model: args.model,
      },
      attempt,
      context: {
        sessionId: args.sessionId,
        sourceId: args.sourceId,
        reason: args.reason,
        revision: args.revision,
      },
    })

    try {
      await toolUsageCostService.recordLlmStreamCost(ctx, {
        operation: 'speaking-translation-segment',
        modelId: attempt.model,
        providerName: process.env.LLM_PROVIDER,
        threadId: args.sessionId
          ? `speaking:${args.sessionId}`
          : `translation:${args.targetLanguage}`,
        inputText: args.text,
        outputText: attempt.text,
        metadata: {
          sourceId: args.sourceId,
          reason: args.reason,
          revision: args.revision,
          status: attempt.status,
        },
      })
    } catch (costError) {
      console.error('Failed to record translation segment cost', costError)
    }

    if (attempt.status === 'error') {
      throw attempt.error
    }

    return {
      text: attempt.text,
      model: attempt.model,
      timings: attempt.timings,
    }
  }

export const translateSegment = action({
  args: {
    text: v.string(),
    targetLanguage: v.string(),
    sourceLanguage: v.optional(v.string()),
    model: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    reason: v.optional(
      v.union(v.literal('timer'), v.literal('immediate'), v.literal('force')),
    ),
    revision: v.optional(v.number()),
  },
  handler: createTranslateSegmentHandler(),
})
