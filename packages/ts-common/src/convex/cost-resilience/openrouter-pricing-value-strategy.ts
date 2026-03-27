import type { OpenRouterRawModelRecord } from './openrouter-pricing-source-types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toPositiveNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return parsed
}

const getPricingObject = (model: OpenRouterRawModelRecord) =>
  isRecord(model.pricing) ? model.pricing : undefined

export type OpenRouterPricingValueSelection = {
  amountUsdPerUnit: number
  unitType: string
  currency: string
  metadata?: Record<string, unknown>
}

export interface OpenRouterPricingValueStrategy {
  selectPricingValue: (
    model: OpenRouterRawModelRecord,
  ) => OpenRouterPricingValueSelection | undefined
}

class DefaultOpenRouterPricingValueStrategy implements OpenRouterPricingValueStrategy {
  selectPricingValue(model: OpenRouterRawModelRecord) {
    const pricing = getPricingObject(model)
    const promptUsdPerUnit =
      toPositiveNumber(pricing?.prompt) ??
      toPositiveNumber(pricing?.prompt_tokens)
    const completionUsdPerUnit =
      toPositiveNumber(pricing?.completion) ??
      toPositiveNumber(pricing?.completion_tokens)
    const inputUsdPerUnit = toPositiveNumber(pricing?.input)
    const outputUsdPerUnit = toPositiveNumber(pricing?.output)
    const requestUsdPerUnit =
      toPositiveNumber(pricing?.request) ??
      toPositiveNumber(pricing?.per_request)
    const genericUsdPerUnit =
      toPositiveNumber(pricing?.price) ??
      toPositiveNumber(pricing?.cost_per_unit) ??
      toPositiveNumber(pricing?.costPerUnit)

    const candidates = [
      promptUsdPerUnit,
      completionUsdPerUnit,
      inputUsdPerUnit,
      outputUsdPerUnit,
      requestUsdPerUnit,
      genericUsdPerUnit,
    ].filter((value): value is number => typeof value === 'number')
    if (candidates.length === 0) {
      return undefined
    }

    const metadata: Record<string, unknown> = {}
    if (promptUsdPerUnit) {
      metadata.promptUsdPerUnit = promptUsdPerUnit
    }
    if (completionUsdPerUnit) {
      metadata.completionUsdPerUnit = completionUsdPerUnit
    }
    if (inputUsdPerUnit) {
      metadata.inputUsdPerUnit = inputUsdPerUnit
    }
    if (outputUsdPerUnit) {
      metadata.outputUsdPerUnit = outputUsdPerUnit
    }
    if (requestUsdPerUnit) {
      metadata.requestUsdPerUnit = requestUsdPerUnit
    }

    return {
      amountUsdPerUnit: Math.max(...candidates),
      unitType: 'tokens',
      currency: 'USD',
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }
  }
}

export const createDefaultOpenRouterPricingValueStrategy =
  (): OpenRouterPricingValueStrategy =>
    new DefaultOpenRouterPricingValueStrategy()
