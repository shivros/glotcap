import type { AICostArgs, ToolCostArgs } from '../cost-core'

export type CostFailurePolicy = 'bestEffort' | 'strict'

export type CostRecordOperation = 'recordAICost' | 'recordToolCost'

export type MissingPricingTarget = 'model' | 'tool'

export type PricingFailureClassification =
  | { kind: 'missingPricing'; target: MissingPricingTarget }
  | { kind: 'other' }

export type AIPricingRefreshScope =
  | {
      type: 'providerModel'
      providerId: string
      modelId?: string
    }
  | {
      type: 'openrouterUserModels'
      endpoint: '/api/v1/models/user'
      providerId?: string
      userId?: string
      profileId?: string
      baseUrl?: string
    }

export type AIPricingRefreshRequest = {
  scope?: AIPricingRefreshScope
  reason?: 'missing_pricing_retry' | 'bootstrap' | string
}

export type ToolPricingLookupArgs = {
  providerId: string
  toolId: string
}

export type ToolPricingUpsertArgs = {
  providerId: string
  providerName: string
  toolId: string
  unitType: string
  costPerUnitUsd: number
}

export interface AICostWritePort<TCtx> {
  addAICostRecord: (ctx: TCtx, args: AICostArgs) => Promise<void>
}

export interface ToolCostWritePort<TCtx> {
  addToolCostRecord: (ctx: TCtx, args: ToolCostArgs) => Promise<void>
}

export type CostWritePort<TCtx> = AICostWritePort<TCtx> &
  ToolCostWritePort<TCtx>

export interface AIPricingRefreshPort<TCtx> {
  refreshAIPricing: (
    ctx: TCtx,
    request?: AIPricingRefreshRequest,
  ) => Promise<unknown>
}

export interface ToolPricingPort<TCtx> {
  getToolPricingById: (
    ctx: TCtx,
    args: ToolPricingLookupArgs,
  ) => Promise<unknown | null | undefined>
  upsertUnitsToolPricing: (
    ctx: TCtx,
    args: ToolPricingUpsertArgs,
  ) => Promise<unknown>
}

export type CostResilienceTelemetryEvent = {
  operation: CostRecordOperation
  stage:
    | 'cooldown_skip'
    | 'recovery_attempt'
    | 'retry_failed'
    | 'cooldown_started'
    | 'failure_suppressed'
    | 'failure_thrown'
  policy: CostFailurePolicy
  pricingKey: string
  message: string
  target?: MissingPricingTarget
  cooldownUntilMs?: number
}

export interface CostResilienceTelemetryPort {
  record: (event: CostResilienceTelemetryEvent) => void
}

export interface CostPricingCooldownStore {
  getCooldownUntilMs: (key: string) => number | undefined
  setCooldownUntilMs: (key: string, cooldownUntilMs: number) => void
  clearCooldown: (key: string) => void
}

export type CostRecorderClock = {
  nowMs: () => number
}

export type RecordCostOptions = {
  failurePolicy?: CostFailurePolicy
}

export type StrictFailureKind =
  | 'cooldown'
  | 'non_pricing_failure'
  | 'retry_failure'
  | 'missing_pricing_after_retry'

export type StrictFailureContext = {
  kind: StrictFailureKind
  operation: CostRecordOperation
  pricingKey: string
  message: string
  target?: MissingPricingTarget
  cooldownUntilMs?: number
  cause?: unknown
}

export interface CostStrictFailureStrategy {
  createStrictError: (context: StrictFailureContext) => Error
}

export type SharedResilienceOptions = {
  telemetry?: CostResilienceTelemetryPort
  cooldownStore?: CostPricingCooldownStore
  clock?: CostRecorderClock
  defaultFailurePolicy?: CostFailurePolicy
  cooldownMs?: number
  classifyPricingFailure?: (error: unknown) => PricingFailureClassification
  strictFailureStrategy?: CostStrictFailureStrategy
}

export type ResilientAICostRecorderConfig<TCtx> = {
  writer: AICostWritePort<TCtx>
  aiPricing: AIPricingRefreshPort<TCtx>
  resolveAIPricingRefreshRequest?: (
    args: AICostArgs,
  ) => AIPricingRefreshRequest | undefined
} & SharedResilienceOptions

export type ResilientToolCostRecorderConfig<TCtx> = {
  writer: ToolCostWritePort<TCtx>
  toolPricing: ToolPricingPort<TCtx>
  resolveToolPricingUpsertArgs: (args: ToolCostArgs) => ToolPricingUpsertArgs
} & SharedResilienceOptions

export interface ResilientAICostRecorderPort<TCtx> {
  recordAICost: (
    ctx: TCtx,
    args: AICostArgs,
    options?: RecordCostOptions,
  ) => Promise<void>
}

export interface ResilientToolCostRecorderPort<TCtx> {
  recordToolCost: (
    ctx: TCtx,
    args: ToolCostArgs,
    options?: RecordCostOptions,
  ) => Promise<void>
}

export type ResilientCostRecorderPort<TCtx> =
  ResilientAICostRecorderPort<TCtx> & ResilientToolCostRecorderPort<TCtx>

export type ResilientCostRecorderConfig<TCtx> = {
  writer: CostWritePort<TCtx>
  aiPricing: AIPricingRefreshPort<TCtx>
  toolPricing: ToolPricingPort<TCtx>
  resolveToolPricingUpsertArgs: (args: ToolCostArgs) => ToolPricingUpsertArgs
  resolveAIPricingRefreshRequest?: (
    args: AICostArgs,
  ) => AIPricingRefreshRequest | undefined
} & SharedResilienceOptions
