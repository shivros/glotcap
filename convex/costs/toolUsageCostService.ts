'use node'

import { createCostMessageId } from 'ts-common/convex/costs'
import {
  resolveImageCostProviderId,
  resolveLlmCostProviderId,
  resolveSttCostProviderId,
  resolveTtsCostProviderId,
} from './providerPolicy'
import type { CostActionCtx, CostRecorderPort } from './ports'

type BaseToolCostArgs = {
  operation: string
  threadId: string
  userId?: string
  metadata?: Record<string, unknown>
}

type LlmStreamCostArgs = BaseToolCostArgs & {
  modelId: string
  providerName?: string
  inputText?: string
  outputText?: string
}

type TtsCostArgs = BaseToolCostArgs & {
  modelId: string
  providerName?: string
  text: string
}

type SttSessionCostArgs = BaseToolCostArgs & {
  modelId: string
  providerName?: string
  sessionUnits?: number
}

type TranscriptionCostArgs = BaseToolCostArgs & {
  modelId: string
  providerName?: string
  transcriptText: string
  audioSeconds?: number
}

type ImageCostArgs = BaseToolCostArgs & {
  modelId: string
  providerName?: string
  imageCount: number
}

const normalizeTextUnits = (text?: string) => {
  if (!text) {
    return 0
  }
  return Math.max(0, text.trim().length)
}

const normalizeUnits = (units?: number) => {
  if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0) {
    return 1
  }
  return units
}

export class ToolUsageCostService {
  constructor(private readonly recorder: CostRecorderPort) {}

  async recordLlmStreamCost(ctx: CostActionCtx, args: LlmStreamCostArgs) {
    const units =
      normalizeTextUnits(args.inputText) + normalizeTextUnits(args.outputText)

    await this.recorder.recordToolCost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveLlmCostProviderId({
        providerName: args.providerName,
        modelId: args.modelId,
      }),
      toolId: args.modelId,
      units,
      unitType: 'characters',
      metadata: args.metadata,
    })
  }

  async recordTtsCost(ctx: CostActionCtx, args: TtsCostArgs) {
    await this.recorder.recordToolCost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveTtsCostProviderId(args.providerName),
      toolId: args.modelId,
      units: normalizeTextUnits(args.text),
      unitType: 'characters',
      metadata: args.metadata,
    })
  }

  async recordSttSessionCost(ctx: CostActionCtx, args: SttSessionCostArgs) {
    await this.recorder.recordToolCost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveSttCostProviderId(args.providerName),
      toolId: args.modelId,
      units: normalizeUnits(args.sessionUnits),
      unitType: 'sessions',
      metadata: args.metadata,
    })
  }

  async recordTranscriptionCost(
    ctx: CostActionCtx,
    args: TranscriptionCostArgs,
  ) {
    const audioSeconds = normalizeUnits(args.audioSeconds)
    const unitType = args.audioSeconds ? 'audio_seconds' : 'characters'
    const units = args.audioSeconds
      ? audioSeconds
      : normalizeTextUnits(args.transcriptText)

    await this.recorder.recordToolCost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveSttCostProviderId(args.providerName),
      toolId: args.modelId,
      units,
      unitType,
      metadata: args.metadata,
    })
  }

  async recordImageGenerationCost(ctx: CostActionCtx, args: ImageCostArgs) {
    await this.recorder.recordToolCost(ctx, {
      messageId: createCostMessageId(args.operation, [args.threadId]),
      userId: args.userId,
      threadId: args.threadId,
      providerId: resolveImageCostProviderId(args.providerName),
      toolId: args.modelId,
      units: normalizeUnits(args.imageCount),
      unitType: 'images',
      metadata: args.metadata,
    })
  }
}

export function createToolUsageCostService(recorder: CostRecorderPort) {
  return new ToolUsageCostService(recorder)
}
