'use node'

import { createCostMessageId } from 'ts-common/convex/costs'
import { resolveLlmCostProviderId } from './providerPolicy'
import type { StructuredOutputUsage } from 'ts-common/structured-output'
import type { CostActionCtx, CostRecorderPort } from './ports'

type StructuredOutputCostArgs = {
  operation: string
  modelId: string
  providerName?: string
  threadId: string
  userId?: string
  usage?: StructuredOutputUsage
}

function toLlmUsage(usage?: StructuredOutputUsage) {
  const promptTokens = usage?.inputTokens ?? 0
  const completionTokens = usage?.outputTokens ?? 0
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.totalTokens ?? promptTokens + completionTokens,
  }
}

export class StructuredOutputCostService {
  constructor(private readonly recorder: CostRecorderPort) {}

  async recordCompletionCost(
    ctx: CostActionCtx,
    args: StructuredOutputCostArgs,
  ) {
    await this.recorder.recordAICost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveLlmCostProviderId({
        providerName: args.providerName,
        modelId: args.modelId,
      }),
      modelId: args.modelId,
      usage: toLlmUsage(args.usage),
    })
  }
}

export function createStructuredOutputCostService(recorder: CostRecorderPort) {
  return new StructuredOutputCostService(recorder)
}

export async function recordStructuredOutputCostBestEffort(
  service: StructuredOutputCostService,
  ctx: CostActionCtx,
  args: StructuredOutputCostArgs,
) {
  try {
    await service.recordCompletionCost(ctx, args)
  } catch (error) {
    console.error('Failed to record structured output cost', {
      operation: args.operation,
      modelId: args.modelId,
      threadId: args.threadId,
      error,
    })
  }
}
