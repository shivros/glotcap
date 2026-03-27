import { createResilientAICostRecorder } from './ai-recorder'
import { createResilientToolCostRecorder } from './tool-recorder'
import type {
  ResilientCostRecorderConfig,
  ResilientCostRecorderPort,
} from './types'

export const createResilientCostRecorder = <TCtx>(
  config: ResilientCostRecorderConfig<TCtx>,
): ResilientCostRecorderPort<TCtx> => {
  const aiRecorder = createResilientAICostRecorder({
    writer: { addAICostRecord: config.writer.addAICostRecord },
    aiPricing: config.aiPricing,
    resolveAIPricingRefreshRequest: config.resolveAIPricingRefreshRequest,
    telemetry: config.telemetry,
    cooldownStore: config.cooldownStore,
    clock: config.clock,
    defaultFailurePolicy: config.defaultFailurePolicy,
    cooldownMs: config.cooldownMs,
    classifyPricingFailure: config.classifyPricingFailure,
    strictFailureStrategy: config.strictFailureStrategy,
  })

  const toolRecorder = createResilientToolCostRecorder({
    writer: { addToolCostRecord: config.writer.addToolCostRecord },
    toolPricing: config.toolPricing,
    resolveToolPricingUpsertArgs: config.resolveToolPricingUpsertArgs,
    telemetry: config.telemetry,
    cooldownStore: config.cooldownStore,
    clock: config.clock,
    defaultFailurePolicy: config.defaultFailurePolicy,
    cooldownMs: config.cooldownMs,
    classifyPricingFailure: config.classifyPricingFailure,
    strictFailureStrategy: config.strictFailureStrategy,
  })

  return {
    recordAICost: aiRecorder.recordAICost.bind(aiRecorder),
    recordToolCost: toolRecorder.recordToolCost.bind(toolRecorder),
  }
}
