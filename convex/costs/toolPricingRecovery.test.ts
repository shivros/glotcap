// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureToolPricing } from './toolPricingRecovery'

const getToolPricingByIdMock = vi.fn()
const upsertUnitsToolPricingMock = vi.fn()

vi.mock('./neutralCostGateway', () => ({
  getToolPricingById: (...args: Array<unknown>) =>
    getToolPricingByIdMock(...args),
  upsertUnitsToolPricing: (...args: Array<unknown>) =>
    upsertUnitsToolPricingMock(...args),
}))

const ORIGINAL_ENV = {
  REPLICATE_IMAGE_COST_PER_IMAGE_USD:
    process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD,
}

describe('toolPricingRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD
  })

  afterEach(() => {
    if (ORIGINAL_ENV.REPLICATE_IMAGE_COST_PER_IMAGE_USD === undefined) {
      delete process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD
      return
    }
    process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD =
      ORIGINAL_ENV.REPLICATE_IMAGE_COST_PER_IMAGE_USD
  })

  it('returns existing tool pricing without upsert', async () => {
    getToolPricingByIdMock.mockResolvedValueOnce({ _id: 'pricing_1' })
    const result = await ensureToolPricing({} as any, {
      providerId: 'Replicate',
      providerName: 'Replicate',
      toolId: 'Flux',
      unitType: 'images',
    })

    expect(result).toEqual({ _id: 'pricing_1' })
    expect(upsertUnitsToolPricingMock).not.toHaveBeenCalled()
  })

  it('upserts and re-reads when tool pricing is missing', async () => {
    getToolPricingByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'pricing_2' })
    upsertUnitsToolPricingMock.mockResolvedValueOnce('pricing_2')
    process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD = '0.09'

    const result = await ensureToolPricing({} as any, {
      providerId: 'Replicate',
      providerName: 'Replicate',
      toolId: 'Flux',
      unitType: 'images',
    })

    expect(upsertUnitsToolPricingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'replicate',
        providerName: 'Replicate',
        toolId: 'flux',
        unitType: 'images',
        costPerUnitUsd: 0.09,
      }),
    )
    expect(result).toEqual({ _id: 'pricing_2' })
  })

  it('falls back to normalized provider id and default unit type for blank values', async () => {
    getToolPricingByIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'pricing_3' })
    upsertUnitsToolPricingMock.mockResolvedValueOnce('pricing_3')

    await ensureToolPricing({} as any, {
      providerId: 'Replicate',
      providerName: '   ',
      toolId: 'Flux',
      unitType: '   ',
    })

    expect(upsertUnitsToolPricingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'replicate',
        providerName: 'replicate',
        toolId: 'flux',
        unitType: 'units',
      }),
    )
  })
})
