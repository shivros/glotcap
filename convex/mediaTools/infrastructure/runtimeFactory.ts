'use node'

import { createCostRuntime } from '../../costs'
import { OpenAiTranscriptionProvider } from './openAiTranscriptionProvider'
import { ConvexTranslationProviderAdapter } from './translationProviderAdapter'
import { CostTrackingTranscriptionProvider } from './costTrackingTranscriptionProvider'
import { CostTrackingTranslationProvider } from './costTrackingTranslationProvider'
import type { CostActionCtx } from '../../costs/ports'
import type { CostRuntime } from '../../costs/runtimeFactory'
import type {
  ITranscriptionProvider,
  ITranslationProvider,
} from '../application/interfaces'

export const createMediaToolsProviders = (args: {
  ctx: CostActionCtx
  threadId: string
  userId?: string
  costRuntime?: Partial<CostRuntime>
  transcriptionProvider?: ITranscriptionProvider
  translationProvider?: ITranslationProvider
}) => {
  const costRuntime = createCostRuntime(args.costRuntime)

  const baseTranscriptionProvider =
    args.transcriptionProvider ?? new OpenAiTranscriptionProvider()
  const baseTranslationProvider =
    args.translationProvider ?? new ConvexTranslationProviderAdapter()

  return {
    transcriptionProvider: new CostTrackingTranscriptionProvider({
      provider: baseTranscriptionProvider,
      ctx: args.ctx,
      toolUsageCostService: costRuntime.toolUsageCostService,
      threadId: args.threadId,
      userId: args.userId,
      providerName: 'openai',
      modelIdResolver: () => process.env.WHISPER_MODEL ?? 'whisper-1',
    }),
    translationProvider: new CostTrackingTranslationProvider({
      provider: baseTranslationProvider,
      ctx: args.ctx,
      toolUsageCostService: costRuntime.toolUsageCostService,
      threadId: args.threadId,
      userId: args.userId,
      providerNameResolver: () => process.env.LLM_PROVIDER,
      modelIdResolver: () =>
        process.env.OPENROUTER_TRANSLATION_MODEL ??
        process.env.OPENROUTER_COACH_MODEL ??
        'openrouter/auto',
    }),
    costRuntime,
  }
}
