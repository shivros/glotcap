import { normalizeCostModelId, normalizeCostProviderId } from '../cost-core'
import { isCooldownActive, startCooldown } from './cooldown-store'
import { isMissingPricingFailureForTarget } from './classifier'
import {
  maybeThrowByPolicy,
  messageFromError,
  resolveSharedResilienceOptions,
  safeTelemetryRecord,
} from './shared'
import type {
  RecordCostOptions,
  ResilientToolCostRecorderConfig,
  ResilientToolCostRecorderPort,
} from './types'
import type { ToolCostArgs } from '../cost-core'

const getToolPricingKey = (args: ToolCostArgs) =>
  `tool:${normalizeCostProviderId(args.providerId)}:${normalizeCostModelId(args.toolId)}`

const normalizeToolPricingUpsertArgs = (
  args: ReturnType<
    ResilientToolCostRecorderConfig<unknown>['resolveToolPricingUpsertArgs']
  >,
) => {
  const normalizedCost = Number(args.costPerUnitUsd)
  if (!Number.isFinite(normalizedCost) || normalizedCost <= 0) {
    throw new Error('Tool pricing upsert requires a positive costPerUnitUsd.')
  }

  return {
    providerId: normalizeCostProviderId(args.providerId),
    providerName: args.providerName,
    toolId: normalizeCostModelId(args.toolId),
    unitType: args.unitType.trim() || 'units',
    costPerUnitUsd: normalizedCost,
  }
}

class ResilientToolCostRecorder<
  TCtx,
> implements ResilientToolCostRecorderPort<TCtx> {
  private readonly shared

  constructor(private readonly config: ResilientToolCostRecorderConfig<TCtx>) {
    this.shared = resolveSharedResilienceOptions(config)
  }

  async recordToolCost(
    ctx: TCtx,
    args: ToolCostArgs,
    options: RecordCostOptions = {},
  ) {
    const policy = options.failurePolicy ?? this.shared.defaultFailurePolicy
    const pricingKey = getToolPricingKey(args)
    const cooldown = isCooldownActive(
      this.shared.cooldownStore,
      pricingKey,
      this.shared.clock.nowMs(),
    )

    if (cooldown.active) {
      const message = `Tool pricing recovery is in cooldown for ${pricingKey}.`
      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordToolCost',
        stage: 'cooldown_skip',
        policy,
        pricingKey,
        message,
        target: 'tool',
        cooldownUntilMs: cooldown.cooldownUntilMs,
      })
      maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
        kind: 'cooldown',
        operation: 'recordToolCost',
        pricingKey,
        message,
        target: 'tool',
        cooldownUntilMs: cooldown.cooldownUntilMs,
      })
      return
    }

    try {
      await this.config.writer.addToolCostRecord(ctx, args)
      this.shared.cooldownStore.clearCooldown(pricingKey)
      return
    } catch (error) {
      const classification = this.shared.classifyPricingFailure(error)
      if (!isMissingPricingFailureForTarget(classification, 'tool')) {
        const message = messageFromError(error)
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordToolCost',
          stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
          policy,
          pricingKey,
          message,
        })
        maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
          kind: 'non_pricing_failure',
          operation: 'recordToolCost',
          pricingKey,
          message,
          cause: error,
        })
        return
      }
    }

    safeTelemetryRecord(this.shared.telemetry, {
      operation: 'recordToolCost',
      stage: 'recovery_attempt',
      policy,
      pricingKey,
      message: 'Retrying tool cost write after pricing upsert.',
      target: 'tool',
    })

    try {
      const providerId = normalizeCostProviderId(args.providerId)
      const toolId = normalizeCostModelId(args.toolId)
      const existing = await this.config.toolPricing.getToolPricingById(ctx, {
        providerId,
        toolId,
      })

      if (!existing) {
        const upsertArgs = normalizeToolPricingUpsertArgs(
          this.config.resolveToolPricingUpsertArgs(args),
        )
        await this.config.toolPricing.upsertUnitsToolPricing(ctx, upsertArgs)
      }

      await this.config.writer.addToolCostRecord(ctx, args)
      this.shared.cooldownStore.clearCooldown(pricingKey)
      return
    } catch (retryError) {
      const retryClassification = this.shared.classifyPricingFailure(retryError)
      const retryMessage = messageFromError(retryError)
      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordToolCost',
        stage: 'retry_failed',
        policy,
        pricingKey,
        message: retryMessage,
        target: 'tool',
      })

      if (isMissingPricingFailureForTarget(retryClassification, 'tool')) {
        const cooldownUntilMs = startCooldown(
          this.shared.cooldownStore,
          pricingKey,
          this.shared.clock.nowMs(),
          this.shared.cooldownMs,
        )
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordToolCost',
          stage: 'cooldown_started',
          policy,
          pricingKey,
          message: 'Tool pricing missing after retry; cooldown started.',
          target: 'tool',
          cooldownUntilMs,
        })
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordToolCost',
          stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
          policy,
          pricingKey,
          message: retryMessage,
          target: 'tool',
        })
        maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
          kind: 'missing_pricing_after_retry',
          operation: 'recordToolCost',
          pricingKey,
          message: retryMessage,
          target: 'tool',
          cause: retryError,
        })
        return
      }

      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordToolCost',
        stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
        policy,
        pricingKey,
        message: retryMessage,
        target: 'tool',
      })
      maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
        kind: 'retry_failure',
        operation: 'recordToolCost',
        pricingKey,
        message: retryMessage,
        target: 'tool',
        cause: retryError,
      })
    }
  }
}

export const createResilientToolCostRecorder = <TCtx>(
  config: ResilientToolCostRecorderConfig<TCtx>,
): ResilientToolCostRecorderPort<TCtx> => new ResilientToolCostRecorder(config)
