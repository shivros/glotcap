import { normalizeCostModelId, normalizeCostProviderId } from '../cost-core'
import type { ToolCostArgs } from '../cost-core'
import type { ToolPricingUpsertArgs } from './types'

const DEFAULT_TOOL_COST_PER_UNIT_USD = 0.01

const normalizePositiveNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

export type ToolPricingUpsertArgsResolver = (
  args: ToolCostArgs,
) => ToolPricingUpsertArgs

export const createDefaultToolPricingUpsertArgsResolver = (
  options: {
    defaultToolCostPerUnitUsd?: number
    resolveProviderDisplayName?: (providerId: string) => string
  } = {},
): ToolPricingUpsertArgsResolver => {
  const defaultCost = normalizePositiveNumber(
    options.defaultToolCostPerUnitUsd ?? DEFAULT_TOOL_COST_PER_UNIT_USD,
    DEFAULT_TOOL_COST_PER_UNIT_USD,
  )
  const resolveProviderDisplayName =
    options.resolveProviderDisplayName ??
    ((providerId: string) =>
      providerId.trim() || normalizeCostProviderId(providerId))

  return (args: ToolCostArgs): ToolPricingUpsertArgs => ({
    providerId: normalizeCostProviderId(args.providerId),
    providerName: resolveProviderDisplayName(args.providerId),
    toolId: normalizeCostModelId(args.toolId),
    unitType: args.unitType?.trim() || 'units',
    costPerUnitUsd: defaultCost,
  })
}
