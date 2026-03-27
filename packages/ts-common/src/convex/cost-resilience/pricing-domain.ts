import { normalizeCostModelId, normalizeCostProviderId } from '../cost-core'
import type { AICostArgs, ToolCostArgs } from '../cost-core'

export const OPENROUTER_USER_MODELS_ENDPOINT = '/api/v1/models/user'
export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai'

export type PricingResolutionTier =
  | 'appOverride'
  | 'openrouterScoped'
  | 'catalogProvider'
  | 'heuristicDefault'

export const PRICING_RESOLUTION_PRECEDENCE: ReadonlyArray<PricingResolutionTier> =
  ['appOverride', 'openrouterScoped', 'catalogProvider', 'heuristicDefault']

export type PricingScopeType =
  | 'global'
  | 'provider'
  | 'providerModel'
  | 'providerTool'
  | 'openrouterUserModels'
  | 'openrouterProfileModels'

export type PricingScopeMetadata = {
  endpoint?: typeof OPENROUTER_USER_MODELS_ENDPOINT
  scopeKey?: string
  providerId?: string
  modelId?: string
  toolId?: string
  unitType?: string
  userId?: string
  profileId?: string
}

export type PricingScope = {
  type: PricingScopeType
  key: string
  baseUrl?: string
  metadata?: PricingScopeMetadata
}

export type AIPricingTarget = {
  kind: 'aiModel'
  providerId: string
  modelId: string
}

export type ToolPricingTarget = {
  kind: 'tool'
  providerId: string
  toolId: string
  unitType?: string
}

export type PricingTarget = AIPricingTarget | ToolPricingTarget

export type PricingProvenance = {
  sourceKind: 'override' | 'openrouter' | 'catalog' | 'heuristic' | string
  sourceId: string
  detail?: string
}

export type PricingRecord = {
  tier: PricingResolutionTier
  source: string
  target: PricingTarget
  amountUsdPerUnit: number
  unitType: string
  currency: string
  scope: PricingScope
  fetchedAtMs: number
  expiresAtMs?: number
  provenance: PricingProvenance
  metadata?: Record<string, unknown>
}

export type PricingContext = {
  target: PricingTarget
  scope?: PricingScope
  metadata?: Record<string, unknown>
}

export type PricingSourceRequest = {
  context: PricingContext
  tier: PricingResolutionTier
  nowMs: number
}

export interface PricingSourcePort<TCtx> {
  listPricingRecords: (
    ctx: TCtx,
    request: PricingSourceRequest,
  ) => Promise<ReadonlyArray<PricingRecord>>
}

export interface PricingReadRepositoryPort<
  TCtx,
> extends PricingSourcePort<TCtx> {}

export interface PricingWriteRepositoryPort<TCtx> {
  upsertPricingRecords: (
    ctx: TCtx,
    records: ReadonlyArray<PricingRecord>,
  ) => Promise<void>
}

export type PricingRepositoryPort<TCtx> = PricingReadRepositoryPort<TCtx> &
  Partial<PricingWriteRepositoryPort<TCtx>>

export type ResolvedPricingDecision = {
  status: 'resolved'
  record: PricingRecord
  attemptedTiers: Array<PricingResolutionTier>
}

export type UnresolvedPricingDecision = {
  status: 'unresolved'
  attemptedTiers: Array<PricingResolutionTier>
  reason: 'pricing_not_found'
  shouldSkipCostWrite: true
}

export type PricingResolutionResult =
  | ResolvedPricingDecision
  | UnresolvedPricingDecision

export interface PricingResolverPort<TCtx> {
  resolvePricing: (
    ctx: TCtx,
    context: PricingContext,
  ) => Promise<PricingResolutionResult>
}

export type PricingResolverClock = {
  nowMs: () => number
}

const normalizeValue = (value: string) => value.trim().toLowerCase()

const normalizeBaseUrl = (value: string) =>
  value.trim().replace(/\/+$/, '').toLowerCase()

const buildScopeKey = (parts: ReadonlyArray<string>) => parts.join(':')

export const createGlobalPricingScope = (): PricingScope => ({
  type: 'global',
  key: 'global',
})

export const createProviderPricingScope = (
  providerId: string,
): PricingScope => {
  const normalizedProviderId = normalizeCostProviderId(providerId)
  return {
    type: 'provider',
    key: buildScopeKey(['provider', normalizedProviderId]),
    metadata: {
      providerId: normalizedProviderId,
    },
  }
}

export const createProviderModelPricingScope = (
  providerId: string,
  modelId: string,
): PricingScope => {
  const normalizedProviderId = normalizeCostProviderId(providerId)
  const normalizedModelId = normalizeCostModelId(modelId)
  return {
    type: 'providerModel',
    key: buildScopeKey([
      'providerModel',
      normalizedProviderId,
      normalizedModelId,
    ]),
    metadata: {
      providerId: normalizedProviderId,
      modelId: normalizedModelId,
    },
  }
}

export const createProviderToolPricingScope = (
  providerId: string,
  toolId: string,
  unitType?: string,
): PricingScope => {
  const normalizedProviderId = normalizeCostProviderId(providerId)
  const normalizedToolId = normalizeCostModelId(toolId)
  const normalizedUnitType = unitType?.trim() || 'units'
  return {
    type: 'providerTool',
    key: buildScopeKey([
      'providerTool',
      normalizedProviderId,
      normalizedToolId,
      normalizeValue(normalizedUnitType),
    ]),
    metadata: {
      providerId: normalizedProviderId,
      toolId: normalizedToolId,
      unitType: normalizedUnitType,
    },
  }
}

export const createOpenRouterUserPricingScope = (options: {
  providerId?: string
  userId?: string
  baseUrl?: string
  scopeKey?: string
}): PricingScope => {
  const providerId = normalizeCostProviderId(options.providerId ?? 'openrouter')
  const userId = options.userId?.trim()
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL,
  )
  const scopeUser = userId ? normalizeValue(userId) : 'anonymous'
  return {
    type: 'openrouterUserModels',
    key: buildScopeKey([
      'openrouterUserModels',
      baseUrl,
      providerId,
      scopeUser,
    ]),
    baseUrl,
    metadata: {
      endpoint: OPENROUTER_USER_MODELS_ENDPOINT,
      scopeKey: options.scopeKey?.trim() || undefined,
      providerId,
      userId,
    },
  }
}

export const createOpenRouterProfilePricingScope = (options: {
  providerId?: string
  profileId: string
  baseUrl?: string
  scopeKey?: string
}): PricingScope => {
  const providerId = normalizeCostProviderId(options.providerId ?? 'openrouter')
  const profileId = options.profileId.trim()
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL,
  )
  return {
    type: 'openrouterProfileModels',
    key: buildScopeKey([
      'openrouterProfileModels',
      baseUrl,
      providerId,
      normalizeValue(profileId),
    ]),
    baseUrl,
    metadata: {
      endpoint: OPENROUTER_USER_MODELS_ENDPOINT,
      scopeKey: options.scopeKey?.trim() || undefined,
      providerId,
      profileId,
    },
  }
}

export const createAIPricingContext = (
  args: AICostArgs,
  options: {
    profileId?: string
    baseUrl?: string
  } = {},
): PricingContext => {
  const providerId = normalizeCostProviderId(args.providerId)
  const modelId = normalizeCostModelId(args.modelId)

  let scope: PricingScope
  if (providerId === 'openrouter' && options.profileId?.trim()) {
    scope = createOpenRouterProfilePricingScope({
      providerId,
      profileId: options.profileId,
      baseUrl: options.baseUrl,
    })
  } else if (providerId === 'openrouter') {
    scope = createOpenRouterUserPricingScope({
      providerId,
      userId: args.userId,
      baseUrl: options.baseUrl,
    })
  } else {
    scope = createProviderModelPricingScope(providerId, modelId)
  }

  return {
    target: {
      kind: 'aiModel',
      providerId,
      modelId,
    },
    scope,
  }
}

export const createToolPricingContext = (
  args: ToolCostArgs,
): PricingContext => {
  const providerId = normalizeCostProviderId(args.providerId)
  const toolId = normalizeCostModelId(args.toolId)
  const unitType = args.unitType?.trim() || 'units'
  return {
    target: {
      kind: 'tool',
      providerId,
      toolId,
      unitType,
    },
    scope: createProviderToolPricingScope(providerId, toolId, unitType),
  }
}

export const isPricingRecordExpired = (record: PricingRecord, nowMs: number) =>
  typeof record.expiresAtMs === 'number' &&
  Number.isFinite(record.expiresAtMs) &&
  record.expiresAtMs <= nowMs

export const isOpenRouterPricingScopeType = (type: PricingScopeType) =>
  type === 'openrouterUserModels' || type === 'openrouterProfileModels'
