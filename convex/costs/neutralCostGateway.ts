'use node'

import { CostComponent } from 'neutral-cost'
import {
  buildAICostRecordInput,
  buildToolCostRecordInput,
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'
import { components } from '../_generated/api'
import type { CostActionCtx } from './ports'
import type {
  AICostArgs,
  AIPricingRefreshRequest,
  ToolCostArgs,
} from 'ts-common/convex/costs'

const costComponent = new CostComponent(components.neutralCost)

export async function addAICostRecord(ctx: CostActionCtx, args: AICostArgs) {
  return costComponent.addAICost(ctx, buildAICostRecordInput(args))
}

export async function addToolCostRecord(
  ctx: CostActionCtx,
  args: ToolCostArgs,
) {
  return costComponent.addToolCost(ctx, buildToolCostRecordInput(args))
}

export async function refreshAIPricing(
  ctx: CostActionCtx,
  _request?: AIPricingRefreshRequest,
) {
  const key = process.env.MODELS_DEV_API_KEY
  const envKeys = key ? { MODELS_DEV_API_KEY: key } : undefined
  return costComponent.updatePricingData(ctx, envKeys)
}

export async function getToolPricingById(
  ctx: CostActionCtx,
  args: { providerId: string; toolId: string },
) {
  return costComponent.getToolPricing(
    ctx,
    normalizeCostProviderId(args.providerId),
    normalizeCostModelId(args.toolId),
  )
}

export async function upsertUnitsToolPricing(
  ctx: CostActionCtx,
  args: {
    providerId: string
    providerName: string
    toolId: string
    unitType: string
    costPerUnitUsd: number
  },
) {
  return ctx.runMutation(components.neutralCost.pricing.upsertToolPricing, {
    providerId: normalizeCostProviderId(args.providerId),
    providerName: args.providerName,
    modelId: normalizeCostModelId(args.toolId),
    modelName: normalizeCostModelId(args.toolId),
    pricing: {
      type: 'units',
      costPerUnit: args.costPerUnitUsd,
      unitType: args.unitType,
      currency: 'USD',
    },
    limits: undefined,
  })
}
