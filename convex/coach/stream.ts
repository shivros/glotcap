import { createLlmClient } from 'ts-common/llm'
import { internal } from '../_generated/api'
import { createCostRuntime } from '../costs'
import {
  DEFAULT_COACH_TEMPERATURE,
  MAX_COACH_HISTORY_MESSAGES,
  requireEnv,
} from './config'
import { fetchCoachHistory } from './history'
import { buildCoachSystemPrompt } from './prompt'
import type { ChatMessage, LlmProvider } from 'ts-common/llm'
import type { Id } from '../_generated/dataModel'
import type { CoachStreamContext } from './types'
import type { ToolUsageCostService } from '../costs/toolUsageCostService'

type CoachStreamParams = {
  ctx: CoachStreamContext
  sessionId: Id<'speakingSessions'>
  eventId: Id<'speakingEvents'>
  streamId: string
  targetLanguage: string
  sourceLanguage?: string
  userId?: Id<'users'>
  append: (chunk: string) => Promise<void>
  model?: string
  temperature?: number
}

type RunCoachStreamDeps = {
  toolUsageCostService?: ToolUsageCostService
}

const resolveCoachModel = (override?: string) =>
  override ?? requireEnv('OPENROUTER_COACH_MODEL')

const resolveCoachTemperature = (override?: number) =>
  override ?? DEFAULT_COACH_TEMPERATURE

const createCoachClient = () =>
  createLlmClient({
    provider: (process.env.LLM_PROVIDER ?? 'openrouter') as LlmProvider,
    apiKey: requireEnv('OPENROUTER_API_KEY'),
    model: resolveCoachModel(),
    siteUrl: process.env.OPENROUTER_SITE_URL,
    appName: process.env.OPENROUTER_APP_NAME,
  })

export const runCoachStream = async (
  {
    ctx,
    sessionId,
    eventId,
    streamId,
    targetLanguage,
    sourceLanguage,
    userId,
    append,
    model,
    temperature,
  }: CoachStreamParams,
  deps: RunCoachStreamDeps = {},
) => {
  const toolUsageCostService =
    deps.toolUsageCostService ?? createCostRuntime().toolUsageCostService
  const history = await fetchCoachHistory(ctx, {
    sessionId,
    excludeStreamId: streamId,
    limit: MAX_COACH_HISTORY_MESSAGES,
  })

  const systemPrompt = buildCoachSystemPrompt({
    targetLanguage,
    sourceLanguage,
  })

  const messages: Array<ChatMessage> = [
    { role: 'system', content: systemPrompt },
    ...history,
  ]

  const client = createCoachClient()
  const resolvedModel = resolveCoachModel(model)
  const resolvedTemperature = resolveCoachTemperature(temperature)

  let fullText = ''

  try {
    for await (const chunk of client.stream({
      messages,
      model: resolvedModel,
      temperature: resolvedTemperature,
    })) {
      fullText += chunk
      await append(chunk)
    }

    await ctx.runMutation(internal.speaking.updateStreamEvent, {
      eventId,
      text: fullText,
      streamStatus: 'done',
    })

    try {
      await toolUsageCostService.recordLlmStreamCost(ctx, {
        operation: 'speaking-coach-stream',
        modelId: resolvedModel,
        providerName: process.env.LLM_PROVIDER,
        threadId: `speaking:${sessionId}`,
        userId,
        inputText: messages.map((message) => message.content).join('\n'),
        outputText: fullText,
        metadata: {
          eventId,
          streamId,
          status: 'ok',
        },
      })
    } catch (costError) {
      console.error('Failed to record coach streaming cost', costError)
    }

    try {
      await ctx.runAction(internal.vocabulary.analyzeCoachTurn, {
        eventId,
      })
    } catch (err) {
      console.error('Vocabulary analysis failed', err)
    }
  } catch (err) {
    await ctx.runMutation(internal.speaking.updateStreamEvent, {
      eventId,
      streamStatus: 'error',
    })

    try {
      await toolUsageCostService.recordLlmStreamCost(ctx, {
        operation: 'speaking-coach-stream',
        modelId: resolvedModel,
        providerName: process.env.LLM_PROVIDER,
        threadId: `speaking:${sessionId}`,
        userId,
        inputText: messages.map((message) => message.content).join('\n'),
        outputText: fullText,
        metadata: {
          eventId,
          streamId,
          status: 'error',
        },
      })
    } catch (costError) {
      console.error('Failed to record coach streaming cost', costError)
    }

    throw err
  }
}
