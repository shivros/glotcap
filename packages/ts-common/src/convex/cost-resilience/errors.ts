import type {
  CostRecordOperation,
  MissingPricingTarget,
  StrictFailureContext,
} from './types'

export class CostResilienceStrictError extends Error {
  readonly operation: CostRecordOperation
  readonly pricingKey: string
  readonly target?: MissingPricingTarget
  declare readonly cause?: unknown

  constructor(
    message: string,
    args: {
      operation: CostRecordOperation
      pricingKey: string
      target?: MissingPricingTarget
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'CostResilienceStrictError'
    this.operation = args.operation
    this.pricingKey = args.pricingKey
    this.target = args.target
    this.cause = args.cause
  }
}

export class CostRecoveryCooldownError extends CostResilienceStrictError {
  readonly cooldownUntilMs: number

  constructor(
    message: string,
    args: {
      operation: CostRecordOperation
      pricingKey: string
      target?: MissingPricingTarget
      cooldownUntilMs: number
      cause?: unknown
    },
  ) {
    super(message, args)
    this.name = 'CostRecoveryCooldownError'
    this.cooldownUntilMs = args.cooldownUntilMs
  }
}

export class MissingPricingAfterRetryError extends CostResilienceStrictError {
  constructor(
    message: string,
    args: {
      operation: CostRecordOperation
      pricingKey: string
      target?: MissingPricingTarget
      cause?: unknown
    },
  ) {
    super(message, args)
    this.name = 'MissingPricingAfterRetryError'
  }
}

export class CostWriteFailureError extends CostResilienceStrictError {
  constructor(
    message: string,
    args: {
      operation: CostRecordOperation
      pricingKey: string
      target?: MissingPricingTarget
      cause?: unknown
    },
  ) {
    super(message, args)
    this.name = 'CostWriteFailureError'
  }
}

export const createDefaultStrictFailureError = (
  context: StrictFailureContext,
): Error => {
  if (context.kind === 'cooldown' && context.cooldownUntilMs !== undefined) {
    return new CostRecoveryCooldownError(context.message, {
      operation: context.operation,
      pricingKey: context.pricingKey,
      target: context.target,
      cooldownUntilMs: context.cooldownUntilMs,
      cause: context.cause,
    })
  }

  if (context.kind === 'missing_pricing_after_retry') {
    return new MissingPricingAfterRetryError(context.message, {
      operation: context.operation,
      pricingKey: context.pricingKey,
      target: context.target,
      cause: context.cause,
    })
  }

  return new CostWriteFailureError(context.message, {
    operation: context.operation,
    pricingKey: context.pricingKey,
    target: context.target,
    cause: context.cause,
  })
}
