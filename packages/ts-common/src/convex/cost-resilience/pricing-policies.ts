import { normalizeCostModelId, normalizeCostProviderId } from '../cost-core'
import {
  isOpenRouterPricingScopeType,
  isPricingRecordExpired,
} from './pricing-domain'
import type {
  PricingContext,
  PricingRecord,
  PricingResolutionTier,
  PricingScope,
  PricingScopeMetadata,
} from './pricing-domain'

export interface TierCompatibilityPolicy {
  isCompatible: (context: PricingContext, record: PricingRecord) => boolean
}

export type PricingRecordSelectionArgs = {
  context: PricingContext
  records: ReadonlyArray<PricingRecord>
  nowMs: number
  compatibilityPolicy: TierCompatibilityPolicy
}

export interface RecordSelectionStrategy {
  select: (args: PricingRecordSelectionArgs) => PricingRecord | undefined
}

const scopeSpecificityWeight: Record<PricingScope['type'], number> = {
  openrouterProfileModels: 60,
  openrouterUserModels: 50,
  providerModel: 40,
  providerTool: 35,
  provider: 20,
  global: 10,
}

const normalizeValue = (value: string) => value.trim().toLowerCase()

const normalizeBaseUrl = (value?: string) => {
  if (!value) {
    return undefined
  }
  return value.trim().replace(/\/+$/, '').toLowerCase()
}

const normalizeScopeKey = (scope: PricingScope | undefined) =>
  scope?.key ? normalizeValue(scope.key) : undefined

const normalizeMetadataValue = (
  value: PricingScopeMetadata[keyof PricingScopeMetadata] | undefined,
) => {
  if (typeof value !== 'string') {
    return value
  }
  return normalizeValue(value)
}

const hasSubsetScopeMetadata = (
  expected: PricingScopeMetadata | undefined,
  actual: PricingScopeMetadata | undefined,
) => {
  if (!expected) {
    return true
  }

  const expectedKeys = Object.keys(expected) as Array<
    keyof PricingScopeMetadata
  >
  for (const key of expectedKeys) {
    const expectedValue = expected[key]
    if (typeof expectedValue === 'undefined') {
      continue
    }

    const actualValue = actual?.[key]
    if (
      normalizeMetadataValue(actualValue) !==
      normalizeMetadataValue(expectedValue)
    ) {
      return false
    }
  }
  return true
}

const isOpenRouterScopeCompatible = (
  contextScope: PricingScope | undefined,
  recordScope: PricingScope,
) => {
  if (!isOpenRouterPricingScopeType(recordScope.type)) {
    return false
  }
  if (!contextScope || !isOpenRouterPricingScopeType(contextScope.type)) {
    return true
  }
  if (contextScope.type !== recordScope.type) {
    return false
  }
  const contextScopeKey = normalizeScopeKey(contextScope)
  if (contextScopeKey && contextScopeKey !== normalizeScopeKey(recordScope)) {
    return false
  }
  const contextBaseUrl = normalizeBaseUrl(contextScope.baseUrl)
  if (
    contextBaseUrl &&
    contextBaseUrl !== normalizeBaseUrl(recordScope.baseUrl)
  ) {
    return false
  }
  return hasSubsetScopeMetadata(contextScope.metadata, recordScope.metadata)
}

const isTierCompatible = (
  tier: PricingResolutionTier,
  context: PricingContext,
  record: PricingRecord,
) => {
  if (record.tier !== tier) {
    return false
  }

  if (tier === 'openrouterScoped') {
    return isOpenRouterScopeCompatible(context.scope, record.scope)
  }

  if (isOpenRouterPricingScopeType(record.scope.type)) {
    return false
  }

  return true
}

const recordMatchesTarget = (
  context: PricingContext,
  record: PricingRecord,
) => {
  const contextTarget = context.target
  const recordTarget = record.target
  if (contextTarget.kind !== recordTarget.kind) {
    return false
  }

  if (
    normalizeCostProviderId(contextTarget.providerId) !==
    normalizeCostProviderId(recordTarget.providerId)
  ) {
    return false
  }

  if (contextTarget.kind === 'aiModel' && recordTarget.kind === 'aiModel') {
    return (
      normalizeCostModelId(contextTarget.modelId) ===
      normalizeCostModelId(recordTarget.modelId)
    )
  }

  if (contextTarget.kind === 'tool' && recordTarget.kind === 'tool') {
    const toolIdMatches =
      normalizeCostModelId(contextTarget.toolId) ===
      normalizeCostModelId(recordTarget.toolId)
    if (!toolIdMatches) {
      return false
    }
    if (!contextTarget.unitType) {
      return true
    }
    if (!recordTarget.unitType) {
      return true
    }
    return (
      normalizeValue(contextTarget.unitType) ===
      normalizeValue(recordTarget.unitType)
    )
  }

  return false
}

const isValidPricingRecord = (record: PricingRecord, nowMs: number) => {
  if (
    !Number.isFinite(record.amountUsdPerUnit) ||
    record.amountUsdPerUnit <= 0
  ) {
    return false
  }
  return !isPricingRecordExpired(record, nowMs)
}

const scopeMatchScore = (
  contextScope: PricingScope | undefined,
  record: PricingRecord,
) => {
  if (!contextScope) {
    return 0
  }

  let score = 0
  const contextScopeKey = normalizeScopeKey(contextScope)
  if (contextScopeKey && contextScopeKey === normalizeScopeKey(record.scope)) {
    score += 100
  }

  if (contextScope.type === record.scope.type) {
    score += 25
  }

  const contextBaseUrl = normalizeBaseUrl(contextScope.baseUrl)
  if (
    contextBaseUrl &&
    contextBaseUrl === normalizeBaseUrl(record.scope.baseUrl)
  ) {
    score += 10
  }

  if (hasSubsetScopeMetadata(contextScope.metadata, record.scope.metadata)) {
    score += 5
  }

  return score
}

const freshnessScore = (record: PricingRecord) => {
  if (!Number.isFinite(record.fetchedAtMs)) {
    return 0
  }
  return Math.max(0, Math.floor(record.fetchedAtMs / 1_000_000))
}

const scoreRecord = (context: PricingContext, record: PricingRecord) =>
  scopeMatchScore(context.scope, record) +
  scopeSpecificityWeight[record.scope.type] +
  freshnessScore(record)

const compareByScore = (
  context: PricingContext,
  left: PricingRecord,
  right: PricingRecord,
) => {
  const leftScore = scoreRecord(context, left)
  const rightScore = scoreRecord(context, right)
  if (leftScore !== rightScore) {
    return rightScore - leftScore
  }
  if (left.fetchedAtMs !== right.fetchedAtMs) {
    return right.fetchedAtMs - left.fetchedAtMs
  }
  return 0
}

export const createTierCompatibilityPolicy = (
  tier: PricingResolutionTier,
): TierCompatibilityPolicy => ({
  isCompatible: (context, record) => isTierCompatible(tier, context, record),
})

export const createDefaultTierCompatibilityPolicies = (): Record<
  PricingResolutionTier,
  TierCompatibilityPolicy
> => ({
  appOverride: createTierCompatibilityPolicy('appOverride'),
  openrouterScoped: createTierCompatibilityPolicy('openrouterScoped'),
  catalogProvider: createTierCompatibilityPolicy('catalogProvider'),
  heuristicDefault: createTierCompatibilityPolicy('heuristicDefault'),
})

export const createScoredRecordSelectionStrategy =
  (): RecordSelectionStrategy => ({
    select: ({ compatibilityPolicy, context, records, nowMs }) => {
      const candidates = records
        .filter((record) => compatibilityPolicy.isCompatible(context, record))
        .filter((record) => recordMatchesTarget(context, record))
        .filter((record) => isValidPricingRecord(record, nowMs))
        .slice()
        .sort((left, right) => compareByScore(context, left, right))

      return candidates[0]
    },
  })
