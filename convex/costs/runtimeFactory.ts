'use node'

import { createStructuredOutputCostService } from './structuredOutputCostService'
import { createNeutralCostRecorder } from './neutralCostRecorder'
import { createToolUsageCostService } from './toolUsageCostService'
import type { CostRecorderPort } from './ports'
import type { StructuredOutputCostService } from './structuredOutputCostService'
import type { ToolUsageCostService } from './toolUsageCostService'

export type CostRuntime = {
  recorder: CostRecorderPort
  structuredOutputCostService: StructuredOutputCostService
  toolUsageCostService: ToolUsageCostService
}

export const createCostRuntime = (
  deps: {
    recorder?: CostRecorderPort
    structuredOutputCostService?: StructuredOutputCostService
    toolUsageCostService?: ToolUsageCostService
  } = {},
): CostRuntime => {
  const recorder = deps.recorder ?? createNeutralCostRecorder()
  return {
    recorder,
    structuredOutputCostService:
      deps.structuredOutputCostService ??
      createStructuredOutputCostService(recorder),
    toolUsageCostService:
      deps.toolUsageCostService ?? createToolUsageCostService(recorder),
  }
}
