'use node'

import { createResilientCostRecorderAdapter } from 'ts-common/convex/costs'
import {
  addAICostRecord,
  addToolCostRecord,
  getToolPricingById,
  refreshAIPricing,
  upsertUnitsToolPricing,
} from './neutralCostGateway'
import { resolveToolPricingUpsertArgs } from './pricingDefaults'
import { resolveAIPricingRefreshRequest } from './pricingRefreshScope'
import type {
  ResilientCostRecorderAdapterDefaults,
  ResilientCostRecorderAdapterOptions,
} from 'ts-common/convex/costs'
import type { CostActionCtx, CostRecorderPort } from './ports'

export type ResilientNeutralCostRecorderAdapterOptions =
  ResilientCostRecorderAdapterOptions<CostActionCtx>

const defaultAdapterBindings: ResilientCostRecorderAdapterDefaults<CostActionCtx> =
  {
    writer: {
      addAICostRecord: async (ctx, args) => {
        await addAICostRecord(ctx, args)
      },
      addToolCostRecord: async (ctx, args) => {
        await addToolCostRecord(ctx, args)
      },
    },
    aiPricing: {
      refreshAIPricing,
    },
    toolPricing: {
      getToolPricingById,
      upsertUnitsToolPricing,
    },
    resolveAIPricingRefreshRequest,
    resolveToolPricingUpsertArgs,
  }

export function createResilientNeutralCostRecorderAdapter(
  options: ResilientNeutralCostRecorderAdapterOptions = {},
): CostRecorderPort {
  return createResilientCostRecorderAdapter(defaultAdapterBindings, options)
}
