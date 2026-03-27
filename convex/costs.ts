'use node'

import { v } from 'convex/values'
import {
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'
import { internalAction } from './_generated/server'
import {
  refreshAIPricing,
  upsertUnitsToolPricing,
} from './costs/neutralCostGateway'
import { resolveUnitCostPerUnitUsd } from './costs/pricingDefaults'

export { createNeutralCostRecorder } from './costs/neutralCostRecorder'
export { createStructuredOutputCostService } from './costs/structuredOutputCostService'
export { createToolUsageCostService } from './costs/toolUsageCostService'
export { createCostRuntime } from './costs/runtimeFactory'
export type { CostRecorderPort } from './costs/ports'

export const bootstrapNeutralCostPricing = internalAction({
  args: {
    replicateModel: v.optional(v.string()),
    replicateUnitCostUsd: v.optional(v.number()),
  },
  returns: v.object({
    aiPricingUpdatedModels: v.number(),
    replicatePricingReady: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const ai = await refreshAIPricing(ctx)
    const replicateModel =
      args.replicateModel ??
      process.env.REPLICATE_PERSONA_MODEL ??
      process.env.REPLICATE_MODEL

    if (replicateModel) {
      await upsertUnitsToolPricing(ctx, {
        providerId: normalizeCostProviderId('replicate'),
        providerName: 'Replicate',
        toolId: normalizeCostModelId(replicateModel),
        unitType: 'images',
        costPerUnitUsd:
          args.replicateUnitCostUsd ?? resolveUnitCostPerUnitUsd('images'),
      })
    }

    return {
      aiPricingUpdatedModels: ai.updatedModels,
      replicatePricingReady: Boolean(replicateModel),
    }
  },
})
