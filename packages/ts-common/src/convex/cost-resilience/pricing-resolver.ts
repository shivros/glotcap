import { PRICING_RESOLUTION_PRECEDENCE } from './pricing-domain'
import { createPricingTierRegistry } from './pricing-tier-registry'
import type {
  PricingContext,
  PricingReadRepositoryPort,
  PricingRecord,
  PricingResolutionResult,
  PricingResolutionTier,
  PricingResolverClock,
  PricingResolverPort,
  PricingSourcePort,
} from './pricing-domain'
import type {
  PricingTierRegistry,
  PricingTierRegistryOverrides,
} from './pricing-tier-registry'
import type {
  RecordSelectionStrategy,
  TierCompatibilityPolicy,
} from './pricing-policies'

export type TieredPricingResolverConfig<TCtx> = {
  sources?: Partial<Record<PricingResolutionTier, PricingSourcePort<TCtx>>>
  repository?: PricingReadRepositoryPort<TCtx>
  clock?: PricingResolverClock
  compatibilityPolicies?: Partial<
    Record<PricingResolutionTier, TierCompatibilityPolicy>
  >
  selectionStrategies?: Partial<
    Record<PricingResolutionTier, RecordSelectionStrategy>
  >
  tierRegistry?: PricingTierRegistryOverrides<TCtx>
}

const defaultClock: PricingResolverClock = {
  nowMs: () => Date.now(),
}

class TieredPricingResolver<TCtx> implements PricingResolverPort<TCtx> {
  private readonly clock: PricingResolverClock

  private readonly tierRegistry: PricingTierRegistry<TCtx>

  constructor(config: TieredPricingResolverConfig<TCtx>) {
    this.clock = config.clock ?? defaultClock
    this.tierRegistry = createPricingTierRegistry({
      sources: config.sources,
      repository: config.repository,
      compatibilityPolicies: config.compatibilityPolicies,
      selectionStrategies: config.selectionStrategies,
      overrides: config.tierRegistry,
    })
  }

  async resolvePricing(
    ctx: TCtx,
    context: PricingContext,
  ): Promise<PricingResolutionResult> {
    const nowMs = this.clock.nowMs()
    const attemptedTiers: Array<PricingResolutionTier> = []

    for (const tier of PRICING_RESOLUTION_PRECEDENCE) {
      attemptedTiers.push(tier)

      const entry = this.tierRegistry[tier]
      const source = entry.source
      if (!source) {
        continue
      }

      let records: ReadonlyArray<PricingRecord> = []
      try {
        records = await source.listPricingRecords(ctx, {
          context,
          tier,
          nowMs,
        })
      } catch {
        records = []
      }

      const selected = entry.selectionStrategy.select({
        context,
        records,
        nowMs,
        compatibilityPolicy: entry.compatibilityPolicy,
      })
      if (!selected) {
        continue
      }

      return {
        status: 'resolved',
        record: selected,
        attemptedTiers,
      }
    }

    return {
      status: 'unresolved',
      attemptedTiers,
      reason: 'pricing_not_found',
      shouldSkipCostWrite: true,
    }
  }
}

export const createTieredPricingResolver = <TCtx>(
  config: TieredPricingResolverConfig<TCtx>,
): PricingResolverPort<TCtx> => new TieredPricingResolver(config)
