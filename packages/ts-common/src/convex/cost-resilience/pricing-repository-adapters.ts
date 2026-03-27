import { normalizeCostModelId, normalizeCostProviderId } from '../cost-core'
import { createProviderToolPricingScope } from './pricing-domain'
import type {
  PricingReadRepositoryPort,
  PricingRecord,
  PricingSourcePort,
} from './pricing-domain'

export const createPricingRepositorySource = <TCtx>(
  repository: PricingReadRepositoryPort<TCtx>,
): PricingSourcePort<TCtx> => ({
  listPricingRecords: (ctx, request) =>
    repository.listPricingRecords(ctx, request),
})

export const createStaticPricingSource = <TCtx>(
  records: ReadonlyArray<PricingRecord>,
): PricingSourcePort<TCtx> => ({
  listPricingRecords: (_ctx, request) =>
    Promise.resolve(records.filter((record) => record.tier === request.tier)),
})

export type LegacyToolPricingLookupArgs = {
  providerId: string
  toolId: string
}

export type LegacyToolPricingLookupRecord = {
  providerId?: string
  modelId?: string
  pricing?: {
    type?: string
    costPerUnit?: number
    costPerUnitUsd?: number
    unitType?: string
    currency?: string
  }
  costPerUnitUsd?: number
  unitType?: string
  _creationTime?: number
  updatedAt?: number
  updatedAtMs?: number
}

export interface LegacyToolPricingLookupPort<TCtx> {
  getToolPricingById: (
    ctx: TCtx,
    args: LegacyToolPricingLookupArgs,
  ) => Promise<LegacyToolPricingLookupRecord | null | undefined>
}

export type ToolPricingRepositoryAdapterConfig<TCtx> = {
  lookup: LegacyToolPricingLookupPort<TCtx>
  sourceId?: string
  sourceName?: string
}

const resolveNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

const resolveLegacyCostPerUnitUsd = (record: LegacyToolPricingLookupRecord) => {
  const direct = resolveNumber(record.costPerUnitUsd)
  if (typeof direct === 'number' && direct > 0) {
    return direct
  }

  const nestedCostPerUnit = resolveNumber(record.pricing?.costPerUnit)
  if (typeof nestedCostPerUnit === 'number' && nestedCostPerUnit > 0) {
    return nestedCostPerUnit
  }

  const nestedCostPerUnitUsd = resolveNumber(record.pricing?.costPerUnitUsd)
  if (typeof nestedCostPerUnitUsd === 'number' && nestedCostPerUnitUsd > 0) {
    return nestedCostPerUnitUsd
  }

  return undefined
}

const resolveFetchedAtMs = (
  record: LegacyToolPricingLookupRecord,
  fallbackNowMs: number,
) =>
  resolveNumber(record.updatedAtMs) ??
  resolveNumber(record.updatedAt) ??
  resolveNumber(record._creationTime) ??
  fallbackNowMs

export const createToolPricingRepositoryAdapter = <TCtx>(
  config: ToolPricingRepositoryAdapterConfig<TCtx>,
): PricingReadRepositoryPort<TCtx> => ({
  listPricingRecords: async (ctx, request) => {
    if (request.tier !== 'catalogProvider') {
      return []
    }

    if (request.context.target.kind !== 'tool') {
      return []
    }

    const providerId = normalizeCostProviderId(
      request.context.target.providerId,
    )
    const toolId = normalizeCostModelId(request.context.target.toolId)

    const record = await config.lookup.getToolPricingById(ctx, {
      providerId,
      toolId,
    })
    if (!record) {
      return []
    }

    const amountUsdPerUnit = resolveLegacyCostPerUnitUsd(record)
    if (typeof amountUsdPerUnit !== 'number') {
      return []
    }

    const unitType =
      record.pricing?.unitType ??
      record.unitType ??
      request.context.target.unitType ??
      'units'
    const fetchedAtMs = resolveFetchedAtMs(record, request.nowMs)

    return [
      {
        tier: 'catalogProvider',
        source: config.sourceName ?? 'catalog_provider_repository',
        target: {
          kind: 'tool',
          providerId,
          toolId,
          unitType,
        },
        amountUsdPerUnit,
        unitType,
        currency: record.pricing?.currency ?? 'USD',
        scope: createProviderToolPricingScope(providerId, toolId, unitType),
        fetchedAtMs,
        provenance: {
          sourceKind: 'catalog',
          sourceId: config.sourceId ?? 'legacy_tool_pricing_lookup',
        },
      },
    ] satisfies Array<PricingRecord>
  },
})
