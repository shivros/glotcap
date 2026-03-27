// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isMissingPricingError } from './pricingClassifier'

describe('pricingClassifier', () => {
  it('detects missing model pricing errors', () => {
    expect(
      isMissingPricingError(new Error('Pricing not found for model'), 'model'),
    ).toBe(true)
    expect(isMissingPricingError(new Error('boom'), 'model')).toBe(false)
  })

  it('detects missing tool pricing errors', () => {
    expect(
      isMissingPricingError(new Error('Pricing not found for tool'), 'tool'),
    ).toBe(true)
    expect(isMissingPricingError(new Error('boom'), 'tool')).toBe(false)
  })

  it('ignores non-Error values', () => {
    expect(isMissingPricingError('Pricing not found for model', 'model')).toBe(
      false,
    )
  })
})
