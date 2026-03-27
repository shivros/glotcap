import type {
  MissingPricingTarget,
  PricingFailureClassification,
} from './types'

const isMissingPricingClassification = (
  classification: PricingFailureClassification,
  target: MissingPricingTarget,
) =>
  classification.kind === 'missingPricing' && classification.target === target

export const classifyMissingPricingFailure = (
  error: unknown,
): PricingFailureClassification => {
  if (!(error instanceof Error)) {
    return { kind: 'other' }
  }

  const message = error.message.toLowerCase()
  if (message.includes('pricing not found for model')) {
    return { kind: 'missingPricing', target: 'model' }
  }
  if (message.includes('pricing not found for tool')) {
    return { kind: 'missingPricing', target: 'tool' }
  }
  return { kind: 'other' }
}

export const isMissingPricingError = (
  error: unknown,
  target: MissingPricingTarget,
) =>
  isMissingPricingClassification(classifyMissingPricingFailure(error), target)

export const isMissingPricingFailureForTarget = (
  classification: PricingFailureClassification,
  target: MissingPricingTarget,
) => isMissingPricingClassification(classification, target)
