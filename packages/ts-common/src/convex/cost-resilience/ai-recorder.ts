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
  AIPricingRefreshRequest,
  RecordCostOptions,
  ResilientAICostRecorderConfig,
  ResilientAICostRecorderPort,
} from './types'
import type { AICostArgs } from '../cost-core'

const getAIPricingKey = (args: AICostArgs) =>
  `ai:${normalizeCostProviderId(args.providerId)}:${normalizeCostModelId(args.modelId)}`

const defaultResolveAIPricingRefreshRequest = (
  args: AICostArgs,
): AIPricingRefreshRequest => ({
  reason: 'missing_pricing_retry',
  scope: {
    type: 'providerModel',
    providerId: normalizeCostProviderId(args.providerId),
    modelId: normalizeCostModelId(args.modelId),
  },
})

class ResilientAICostRecorder<
  TCtx,
> implements ResilientAICostRecorderPort<TCtx> {
  private readonly shared
  private readonly resolveAIPricingRefreshRequest: (
    args: AICostArgs,
  ) => AIPricingRefreshRequest | undefined

  constructor(private readonly config: ResilientAICostRecorderConfig<TCtx>) {
    this.shared = resolveSharedResilienceOptions(config)
    this.resolveAIPricingRefreshRequest =
      config.resolveAIPricingRefreshRequest ??
      defaultResolveAIPricingRefreshRequest
  }

  async recordAICost(
    ctx: TCtx,
    args: AICostArgs,
    options: RecordCostOptions = {},
  ) {
    const policy = options.failurePolicy ?? this.shared.defaultFailurePolicy
    const pricingKey = getAIPricingKey(args)
    const cooldown = isCooldownActive(
      this.shared.cooldownStore,
      pricingKey,
      this.shared.clock.nowMs(),
    )

    if (cooldown.active) {
      const message = `AI pricing recovery is in cooldown for ${pricingKey}.`
      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordAICost',
        stage: 'cooldown_skip',
        policy,
        pricingKey,
        message,
        target: 'model',
        cooldownUntilMs: cooldown.cooldownUntilMs,
      })
      maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
        kind: 'cooldown',
        operation: 'recordAICost',
        pricingKey,
        message,
        target: 'model',
        cooldownUntilMs: cooldown.cooldownUntilMs,
      })
      return
    }

    try {
      await this.config.writer.addAICostRecord(ctx, args)
      this.shared.cooldownStore.clearCooldown(pricingKey)
      return
    } catch (error) {
      const classification = this.shared.classifyPricingFailure(error)
      if (!isMissingPricingFailureForTarget(classification, 'model')) {
        const message = messageFromError(error)
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordAICost',
          stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
          policy,
          pricingKey,
          message,
        })
        maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
          kind: 'non_pricing_failure',
          operation: 'recordAICost',
          pricingKey,
          message,
          cause: error,
        })
        return
      }
    }

    safeTelemetryRecord(this.shared.telemetry, {
      operation: 'recordAICost',
      stage: 'recovery_attempt',
      policy,
      pricingKey,
      message: 'Retrying AI cost write after pricing refresh.',
      target: 'model',
    })

    try {
      await this.config.aiPricing.refreshAIPricing(
        ctx,
        this.resolveAIPricingRefreshRequest(args),
      )
      await this.config.writer.addAICostRecord(ctx, args)
      this.shared.cooldownStore.clearCooldown(pricingKey)
      return
    } catch (retryError) {
      const retryClassification = this.shared.classifyPricingFailure(retryError)
      const retryMessage = messageFromError(retryError)
      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordAICost',
        stage: 'retry_failed',
        policy,
        pricingKey,
        message: retryMessage,
        target: 'model',
      })

      if (isMissingPricingFailureForTarget(retryClassification, 'model')) {
        const cooldownUntilMs = startCooldown(
          this.shared.cooldownStore,
          pricingKey,
          this.shared.clock.nowMs(),
          this.shared.cooldownMs,
        )
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordAICost',
          stage: 'cooldown_started',
          policy,
          pricingKey,
          message: 'AI pricing missing after retry; cooldown started.',
          target: 'model',
          cooldownUntilMs,
        })
        safeTelemetryRecord(this.shared.telemetry, {
          operation: 'recordAICost',
          stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
          policy,
          pricingKey,
          message: retryMessage,
          target: 'model',
        })
        maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
          kind: 'missing_pricing_after_retry',
          operation: 'recordAICost',
          pricingKey,
          message: retryMessage,
          target: 'model',
          cause: retryError,
        })
        return
      }

      safeTelemetryRecord(this.shared.telemetry, {
        operation: 'recordAICost',
        stage: policy === 'strict' ? 'failure_thrown' : 'failure_suppressed',
        policy,
        pricingKey,
        message: retryMessage,
        target: 'model',
      })
      maybeThrowByPolicy(policy, this.shared.strictFailureStrategy, {
        kind: 'retry_failure',
        operation: 'recordAICost',
        pricingKey,
        message: retryMessage,
        target: 'model',
        cause: retryError,
      })
    }
  }
}

export const createResilientAICostRecorder = <TCtx>(
  config: ResilientAICostRecorderConfig<TCtx>,
): ResilientAICostRecorderPort<TCtx> => new ResilientAICostRecorder(config)
