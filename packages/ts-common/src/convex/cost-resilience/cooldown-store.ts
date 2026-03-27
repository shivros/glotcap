import type { CostPricingCooldownStore, CostRecorderClock } from './types'

export const DEFAULT_PRICING_MISS_COOLDOWN_MS = 5 * 60 * 1000

export const defaultCostRecorderClock: CostRecorderClock = {
  nowMs: () => Date.now(),
}

export const createInMemoryCostPricingCooldownStore =
  (): CostPricingCooldownStore => {
    const state = new Map<string, number>()
    return {
      getCooldownUntilMs: (key) => state.get(key),
      setCooldownUntilMs: (key, cooldownUntilMs) => {
        state.set(key, cooldownUntilMs)
      },
      clearCooldown: (key) => {
        state.delete(key)
      },
    }
  }

export const isCooldownActive = (
  cooldownStore: CostPricingCooldownStore,
  key: string,
  nowMs: number,
) => {
  const cooldownUntilMs = cooldownStore.getCooldownUntilMs(key)
  if (cooldownUntilMs === undefined) {
    return { active: false as const }
  }
  if (cooldownUntilMs <= nowMs) {
    cooldownStore.clearCooldown(key)
    return { active: false as const }
  }
  return { active: true as const, cooldownUntilMs }
}

export const startCooldown = (
  cooldownStore: CostPricingCooldownStore,
  key: string,
  nowMs: number,
  cooldownMs: number,
) => {
  const cooldownUntilMs = nowMs + cooldownMs
  cooldownStore.setCooldownUntilMs(key, cooldownUntilMs)
  return cooldownUntilMs
}
