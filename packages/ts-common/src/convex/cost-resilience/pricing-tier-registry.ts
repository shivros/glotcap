import { PRICING_RESOLUTION_PRECEDENCE } from './pricing-domain'
import {
  createDefaultTierCompatibilityPolicies,
  createScoredRecordSelectionStrategy,
} from './pricing-policies'
import { createPricingRepositorySource } from './pricing-repository-adapters'
import type {
  PricingReadRepositoryPort,
  PricingResolutionTier,
  PricingSourcePort,
} from './pricing-domain'
import type {
  RecordSelectionStrategy,
  TierCompatibilityPolicy,
} from './pricing-policies'

export type PricingTierRegistryEntry<TCtx> = {
  source?: PricingSourcePort<TCtx>
  compatibilityPolicy: TierCompatibilityPolicy
  selectionStrategy: RecordSelectionStrategy
}

export type PricingTierRegistry<TCtx> = Record<
  PricingResolutionTier,
  PricingTierRegistryEntry<TCtx>
>

export type PricingTierRegistryOverrides<TCtx> = Partial<
  Record<PricingResolutionTier, Partial<PricingTierRegistryEntry<TCtx>>>
>

export type PricingTierRegistryFactoryConfig<TCtx> = {
  sources?: Partial<Record<PricingResolutionTier, PricingSourcePort<TCtx>>>
  repository?: PricingReadRepositoryPort<TCtx>
  compatibilityPolicies?: Partial<
    Record<PricingResolutionTier, TierCompatibilityPolicy>
  >
  selectionStrategies?: Partial<
    Record<PricingResolutionTier, RecordSelectionStrategy>
  >
  overrides?: PricingTierRegistryOverrides<TCtx>
}

const createBaseTierRegistry = <TCtx>(
  config: Omit<PricingTierRegistryFactoryConfig<TCtx>, 'overrides'>,
): PricingTierRegistry<TCtx> => {
  const repositorySource = config.repository
    ? createPricingRepositorySource(config.repository)
    : undefined
  const defaultCompatibilityPolicies = createDefaultTierCompatibilityPolicies()
  const defaultSelectionStrategy = createScoredRecordSelectionStrategy()

  const entries = {} as PricingTierRegistry<TCtx>
  for (const tier of PRICING_RESOLUTION_PRECEDENCE) {
    entries[tier] = {
      source: config.sources?.[tier] ?? repositorySource,
      compatibilityPolicy:
        config.compatibilityPolicies?.[tier] ??
        defaultCompatibilityPolicies[tier],
      selectionStrategy:
        config.selectionStrategies?.[tier] ?? defaultSelectionStrategy,
    }
  }

  return entries
}

export const createPricingTierRegistry = <TCtx>(
  config: PricingTierRegistryFactoryConfig<TCtx>,
): PricingTierRegistry<TCtx> => {
  const base = createBaseTierRegistry(config)
  if (!config.overrides) {
    return base
  }

  const merged = { ...base }
  for (const tier of PRICING_RESOLUTION_PRECEDENCE) {
    const override = config.overrides[tier]
    if (!override) {
      continue
    }

    merged[tier] = {
      source: override.source ?? merged[tier].source,
      compatibilityPolicy:
        override.compatibilityPolicy ?? merged[tier].compatibilityPolicy,
      selectionStrategy:
        override.selectionStrategy ?? merged[tier].selectionStrategy,
    }
  }

  return merged
}
