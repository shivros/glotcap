import { createResilientCostRecorder } from './composite-recorder'
import type { AICostArgs, ToolCostArgs } from '../cost-core'
import type {
  AIPricingRefreshPort,
  AIPricingRefreshRequest,
  CostWritePort,
  ResilientCostRecorderConfig,
  ResilientCostRecorderPort,
  SharedResilienceOptions,
  ToolPricingPort,
  ToolPricingUpsertArgs,
} from './types'

export type ResilientCostRecorderAdapterDefaults<TCtx> = {
  writer: CostWritePort<TCtx>
  aiPricing: AIPricingRefreshPort<TCtx>
  toolPricing: ToolPricingPort<TCtx>
  resolveToolPricingUpsertArgs: (args: ToolCostArgs) => ToolPricingUpsertArgs
  resolveAIPricingRefreshRequest?: (
    args: AICostArgs,
  ) => AIPricingRefreshRequest | undefined
}

export type ResilientCostRecorderAdapterOptions<TCtx> =
  SharedResilienceOptions & {
    writer?: Partial<CostWritePort<TCtx>>
    aiPricing?: Partial<AIPricingRefreshPort<TCtx>>
    toolPricing?: Partial<ToolPricingPort<TCtx>>
    resolveToolPricingUpsertArgs?: (args: ToolCostArgs) => ToolPricingUpsertArgs
    resolveAIPricingRefreshRequest?: (
      args: AICostArgs,
    ) => AIPricingRefreshRequest | undefined
  }

export const createResilientCostRecorderAdapter = <TCtx>(
  defaults: ResilientCostRecorderAdapterDefaults<TCtx>,
  options: ResilientCostRecorderAdapterOptions<TCtx> = {},
): ResilientCostRecorderPort<TCtx> => {
  const writer = {
    ...defaults.writer,
    ...(options.writer ?? {}),
  } satisfies CostWritePort<TCtx>
  const aiPricing = {
    ...defaults.aiPricing,
    ...(options.aiPricing ?? {}),
  } satisfies AIPricingRefreshPort<TCtx>
  const toolPricing = {
    ...defaults.toolPricing,
    ...(options.toolPricing ?? {}),
  } satisfies ToolPricingPort<TCtx>

  const config: ResilientCostRecorderConfig<TCtx> = {
    writer,
    aiPricing,
    toolPricing,
    resolveAIPricingRefreshRequest:
      options.resolveAIPricingRefreshRequest ??
      defaults.resolveAIPricingRefreshRequest,
    resolveToolPricingUpsertArgs:
      options.resolveToolPricingUpsertArgs ??
      defaults.resolveToolPricingUpsertArgs,
    defaultFailurePolicy: options.defaultFailurePolicy,
    telemetry: options.telemetry,
    cooldownStore: options.cooldownStore,
    cooldownMs: options.cooldownMs,
    clock: options.clock,
    classifyPricingFailure: options.classifyPricingFailure,
    strictFailureStrategy: options.strictFailureStrategy,
  }

  return createResilientCostRecorder(config)
}
