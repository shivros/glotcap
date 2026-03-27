'use node'

import { createInMemoryCostPricingCooldownStore } from 'ts-common/convex/costs'
import { createResilientNeutralCostRecorderAdapter } from './resilientRecorderAdapter'
import type { CostRecorderPort } from './ports'
import type { ResilientNeutralCostRecorderAdapterOptions } from './resilientRecorderAdapter'

const sharedCostPricingCooldownStore = createInMemoryCostPricingCooldownStore()

export function createNeutralCostRecorder(
  options: ResilientNeutralCostRecorderAdapterOptions = {},
): CostRecorderPort {
  return createResilientNeutralCostRecorderAdapter({
    ...options,
    cooldownStore: options.cooldownStore ?? sharedCostPricingCooldownStore,
  })
}
