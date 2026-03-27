import { normalizeCostModelId } from '../cost-core'
import {
  OPENROUTER_USER_MODELS_ENDPOINT,
  createOpenRouterProfilePricingScope,
  createOpenRouterUserPricingScope,
} from './pricing-domain'
import { createDefaultOpenRouterPricingValueStrategy } from './openrouter-pricing-value-strategy'
import type { PricingRecord, PricingScope } from './pricing-domain'
import type {
  OpenRouterPricingValueSelection,
  OpenRouterPricingValueStrategy,
} from './openrouter-pricing-value-strategy'
import type {
  OpenRouterRawModelRecord,
  ResolvedOpenRouterPricingSourceRequest,
} from './openrouter-pricing-source-types'

const toTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export const resolveOpenRouterModelIdCandidate = (
  model: OpenRouterRawModelRecord,
) =>
  toTrimmedString(model.id) ??
  toTrimmedString(model.canonical_slug) ??
  toTrimmedString(model.slug) ??
  toTrimmedString(model.model) ??
  toTrimmedString(model.name)

export const createOpenRouterPricingScopeFromRequest = (
  request: ResolvedOpenRouterPricingSourceRequest,
): PricingScope => {
  if (request.profileId) {
    return createOpenRouterProfilePricingScope({
      providerId: request.providerId,
      profileId: request.profileId,
      baseUrl: request.baseUrl,
      scopeKey: request.scopeKey,
    })
  }

  return createOpenRouterUserPricingScope({
    providerId: request.providerId,
    userId: request.userId,
    baseUrl: request.baseUrl,
    scopeKey: request.scopeKey,
  })
}

export type OpenRouterPricingRecordMapperArgs = {
  models: ReadonlyArray<OpenRouterRawModelRecord>
  request: ResolvedOpenRouterPricingSourceRequest
  fetchedAtMs: number
  sourceName: string
  sourceId: string
}

export interface OpenRouterPricingRecordMapperPort {
  mapRecords: (
    args: OpenRouterPricingRecordMapperArgs,
  ) => ReadonlyArray<PricingRecord>
}

export type OpenRouterPricingRecordMapperConfig = {
  pricingValueStrategy?: OpenRouterPricingValueStrategy
}

const mergeRecordMetadata = (
  selection: OpenRouterPricingValueSelection,
  scope: PricingScope,
) => {
  const metadata: Record<string, unknown> = {
    ...(selection.metadata ?? {}),
  }
  if (scope.metadata?.scopeKey) {
    metadata.scopeKey = scope.metadata.scopeKey
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

class OpenRouterPricingRecordMapper implements OpenRouterPricingRecordMapperPort {
  private readonly pricingValueStrategy: OpenRouterPricingValueStrategy

  constructor(config: OpenRouterPricingRecordMapperConfig) {
    this.pricingValueStrategy =
      config.pricingValueStrategy ??
      createDefaultOpenRouterPricingValueStrategy()
  }

  mapRecords(
    args: OpenRouterPricingRecordMapperArgs,
  ): ReadonlyArray<PricingRecord> {
    const scope = createOpenRouterPricingScopeFromRequest(args.request)
    const expiresAtMs =
      typeof args.request.ttlMs === 'number' &&
      Number.isFinite(args.request.ttlMs) &&
      args.request.ttlMs > 0
        ? args.fetchedAtMs + args.request.ttlMs
        : undefined

    const records: Array<PricingRecord> = []
    for (const model of args.models) {
      const modelId = resolveOpenRouterModelIdCandidate(model)
      if (!modelId) {
        continue
      }

      const selection = this.pricingValueStrategy.selectPricingValue(model)
      if (!selection || selection.amountUsdPerUnit <= 0) {
        continue
      }

      records.push({
        tier: 'openrouterScoped',
        source: args.sourceName,
        target: {
          kind: 'aiModel',
          providerId: args.request.providerId,
          modelId: normalizeCostModelId(modelId),
        },
        amountUsdPerUnit: selection.amountUsdPerUnit,
        unitType: selection.unitType || 'tokens',
        currency: selection.currency || 'USD',
        scope,
        fetchedAtMs: args.fetchedAtMs,
        expiresAtMs,
        provenance: {
          sourceKind: 'openrouter',
          sourceId: args.sourceId,
          detail: OPENROUTER_USER_MODELS_ENDPOINT,
        },
        metadata: mergeRecordMetadata(selection, scope),
      })
    }

    return records
  }
}

export const createOpenRouterPricingRecordMapper = (
  config: OpenRouterPricingRecordMapperConfig = {},
): OpenRouterPricingRecordMapperPort =>
  new OpenRouterPricingRecordMapper(config)
