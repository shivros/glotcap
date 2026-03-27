'use node'

import {
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'
import {
  getToolPricingById,
  upsertUnitsToolPricing,
} from './neutralCostGateway'
import { resolveUnitCostPerUnitUsd } from './pricingDefaults'
import type { CostActionCtx } from './ports'

export async function ensureToolPricing(
  ctx: CostActionCtx,
  args: {
    providerId: string
    providerName: string
    toolId: string
    unitType: string
  },
) {
  const providerId = normalizeCostProviderId(args.providerId)
  const toolId = normalizeCostModelId(args.toolId)
  const existing = await getToolPricingById(ctx, { providerId, toolId })
  if (existing) {
    return existing
  }

  await upsertUnitsToolPricing(ctx, {
    providerId,
    providerName: args.providerName.trim() || providerId,
    toolId,
    unitType: args.unitType.trim() || 'units',
    costPerUnitUsd: resolveUnitCostPerUnitUsd(args.unitType),
  })

  return getToolPricingById(ctx, { providerId, toolId })
}
