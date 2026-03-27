import { v } from 'convex/values'
import { createSttSessionBootstrapper } from 'ts-common/speech/stt'
import { action } from './_generated/server'
import { api } from './_generated/api'
import { createCostRuntime } from './costs'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { ToolUsageCostService } from './costs/toolUsageCostService'

type CreateSessionDeps = {
  toolUsageCostService?: ToolUsageCostService
}

export const createCreateSessionHandler =
  (deps: CreateSessionDeps = {}) =>
  async (
    ctx: ActionCtx,
    args: {
      sessionId: Id<'speakingSessions'>
      sampleRate: number
      provider?: 'soniox' | 'deepgram'
      language?: string
      model?: string
    },
  ) => {
    const toolUsageCostService =
      deps.toolUsageCostService ?? createCostRuntime().toolUsageCostService

    const session = await ctx.runQuery(api.speaking.getSession, {
      sessionId: args.sessionId,
    })
    if (!session) {
      throw new Error('Session not found.')
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active.')
    }
    const createConfig = createSttSessionBootstrapper()
    const config = await createConfig({
      sampleRate: args.sampleRate,
      provider: args.provider,
      language: args.language,
      model: args.model,
      sessionReferenceId: args.sessionId,
    })

    try {
      await toolUsageCostService.recordSttSessionCost(ctx, {
        operation: 'stt-session-bootstrap',
        threadId: `speaking:${args.sessionId}`,
        userId: session.userId,
        providerName: config.provider,
        modelId: config.config.model,
        sessionUnits: 1,
      })
    } catch (costError) {
      console.error('Failed to record STT session cost', costError)
    }

    return config
  }

export const createSession = action({
  args: {
    sessionId: v.id('speakingSessions'),
    sampleRate: v.number(),
    provider: v.optional(v.union(v.literal('soniox'), v.literal('deepgram'))),
    language: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: createCreateSessionHandler(),
})
