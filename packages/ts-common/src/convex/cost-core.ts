import type { LlmUsage } from '../llm'
import type { StructuredOutputUsage } from '../structured-output'

type BaseCostArgs = {
  messageId: string
  threadId: string
  userId?: string
}

export type AICostArgs = BaseCostArgs & {
  providerId: string
  modelId: string
  usage: LlmUsage
}

export type ToolCostArgs = BaseCostArgs & {
  providerId: string
  toolId: string
  units?: number
  unitType?: string
  metadata?: Record<string, unknown>
}

const normalizeTokenCount = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.round(value))
}

const normalizeUnits = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }
  return Math.max(1, Math.round(value))
}

const normalizeId = (value: string) => value.trim().toLowerCase()

export const normalizeCostProviderId = (providerId: string) =>
  normalizeId(providerId)

export const normalizeCostModelId = (modelId: string) => normalizeId(modelId)

export const buildAICostRecordInput = (args: AICostArgs) => ({
  messageId: args.messageId.trim(),
  userId: args.userId,
  threadId: args.threadId.trim(),
  providerId: normalizeCostProviderId(args.providerId),
  modelId: normalizeCostModelId(args.modelId),
  usage: {
    promptTokens: normalizeTokenCount(args.usage.promptTokens),
    completionTokens: normalizeTokenCount(args.usage.completionTokens),
    totalTokens: normalizeTokenCount(args.usage.totalTokens),
  },
})

export const buildToolCostRecordInput = (args: ToolCostArgs) => ({
  messageId: args.messageId.trim(),
  userId: args.userId,
  threadId: args.threadId.trim(),
  providerId: normalizeCostProviderId(args.providerId),
  toolId: normalizeCostModelId(args.toolId),
  usage: {
    type: 'units' as const,
    units: normalizeUnits(args.units),
    unitType: args.unitType?.trim() || 'units',
    metadata: args.metadata,
  },
})

export const createCostMessageId = (
  namespace: string,
  parts: Array<string | number | null | undefined> = [],
) => {
  const normalizedNamespace = namespace.trim().toLowerCase()
  const normalizedParts = parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':')
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return normalizedParts
    ? `${normalizedNamespace}:${normalizedParts}:${nonce}`
    : `${normalizedNamespace}:${nonce}`
}

export const toLlmUsageFromStructuredOutput = (
  usage?: StructuredOutputUsage,
): LlmUsage | undefined => {
  if (!usage) {
    return undefined
  }

  const promptTokens = normalizeTokenCount(usage.inputTokens ?? 0)
  const completionTokens = normalizeTokenCount(usage.outputTokens ?? 0)
  const totalTokens = normalizeTokenCount(
    usage.totalTokens ?? promptTokens + completionTokens,
  )

  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return undefined
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  }
}
