import { classifyMissingPricingFailure } from './classifier'
import {
  DEFAULT_PRICING_MISS_COOLDOWN_MS,
  createInMemoryCostPricingCooldownStore,
  defaultCostRecorderClock,
} from './cooldown-store'
import { createDefaultStrictFailureError } from './errors'
import type {
  CostFailurePolicy,
  CostResilienceTelemetryEvent,
  CostResilienceTelemetryPort,
  CostStrictFailureStrategy,
  SharedResilienceOptions,
  StrictFailureContext,
} from './types'

const DEFAULT_FAILURE_POLICY: CostFailurePolicy = 'bestEffort'

export const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const normalizePositiveNumber = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

const createNoopCostResilienceTelemetry = (): CostResilienceTelemetryPort => ({
  record: () => {},
})

export const safeTelemetryRecord = (
  telemetry: CostResilienceTelemetryPort,
  event: CostResilienceTelemetryEvent,
) => {
  try {
    telemetry.record(event)
  } catch {
    // Telemetry must never impact cost recording behavior.
  }
}

export const createDefaultStrictFailureStrategy =
  (): CostStrictFailureStrategy => ({
    createStrictError: (context: StrictFailureContext) =>
      createDefaultStrictFailureError(context),
  })

export const resolveSharedResilienceOptions = (
  options: SharedResilienceOptions,
) => ({
  telemetry: options.telemetry ?? createNoopCostResilienceTelemetry(),
  cooldownStore:
    options.cooldownStore ?? createInMemoryCostPricingCooldownStore(),
  clock: options.clock ?? defaultCostRecorderClock,
  defaultFailurePolicy: options.defaultFailurePolicy ?? DEFAULT_FAILURE_POLICY,
  cooldownMs: normalizePositiveNumber(
    options.cooldownMs ?? DEFAULT_PRICING_MISS_COOLDOWN_MS,
    DEFAULT_PRICING_MISS_COOLDOWN_MS,
  ),
  classifyPricingFailure:
    options.classifyPricingFailure ?? classifyMissingPricingFailure,
  strictFailureStrategy:
    options.strictFailureStrategy ?? createDefaultStrictFailureStrategy(),
})

export const maybeThrowByPolicy = (
  policy: CostFailurePolicy,
  strictFailureStrategy: CostStrictFailureStrategy,
  context: StrictFailureContext,
) => {
  if (policy === 'strict') {
    throw strictFailureStrategy.createStrictError(context)
  }
}
