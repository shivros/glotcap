'use node'

import type { GenericActionCtx } from 'convex/server'
import type { AICostArgs, ToolCostArgs } from 'ts-common/convex/costs'

export type CostActionCtx = GenericActionCtx<any>

export type RecordAICostInput = AICostArgs
export type RecordToolCostInput = ToolCostArgs

export interface CostRecorderPort {
  recordAICost: (ctx: CostActionCtx, args: RecordAICostInput) => Promise<void>
  recordToolCost: (
    ctx: CostActionCtx,
    args: RecordToolCostInput,
  ) => Promise<void>
}
