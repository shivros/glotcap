// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshAIPricingMock = vi.fn()
const resolveUnitCostPerUnitUsdMock = vi.fn()
const resolveToolPricingUpsertArgsMock = vi.fn()
const upsertUnitsToolPricingMock = vi.fn()

vi.mock('./_generated/server', () => ({
  internalAction: (definition: unknown) => definition,
}))

vi.mock('./costs/neutralCostGateway', () => ({
  addAICostRecord: vi.fn(),
  addToolCostRecord: vi.fn(),
  refreshAIPricing: (...args: Array<unknown>) => refreshAIPricingMock(...args),
  getToolPricingById: vi.fn(),
  upsertUnitsToolPricing: (...args: Array<unknown>) =>
    upsertUnitsToolPricingMock(...args),
}))

vi.mock('./costs/pricingDefaults', () => ({
  resolveUnitCostPerUnitUsd: (...args: Array<unknown>) =>
    resolveUnitCostPerUnitUsdMock(...args),
  resolveToolPricingUpsertArgs: (...args: Array<unknown>) =>
    resolveToolPricingUpsertArgsMock(...args),
}))

describe('bootstrapNeutralCostPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshAIPricingMock.mockResolvedValue({ updatedModels: 8 })
    resolveUnitCostPerUnitUsdMock.mockReturnValue(0.04)
    resolveToolPricingUpsertArgsMock.mockImplementation((args: any) => ({
      providerId: args.providerId,
      providerName: args.providerId,
      toolId: args.toolId,
      unitType: 'units',
      costPerUnitUsd: 0.01,
    }))
    delete process.env.REPLICATE_PERSONA_MODEL
    delete process.env.REPLICATE_MODEL
  })

  it('updates AI pricing and does not upsert replicate pricing when model missing', async () => {
    const module = (await import('./costs')) as any
    const result = await module.bootstrapNeutralCostPricing.handler(
      {},
      {
        replicateModel: undefined,
        replicateUnitCostUsd: undefined,
      },
    )

    expect(refreshAIPricingMock).toHaveBeenCalledTimes(1)
    expect(upsertUnitsToolPricingMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      aiPricingUpdatedModels: 8,
      replicatePricingReady: false,
    })
  })

  it('upserts replicate tool pricing with explicit args override', async () => {
    const module = (await import('./costs')) as any
    const result = await module.bootstrapNeutralCostPricing.handler(
      {},
      {
        replicateModel: 'Black-Forest-Labs/Flux',
        replicateUnitCostUsd: 0.11,
      },
    )

    expect(upsertUnitsToolPricingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'replicate',
        providerName: 'Replicate',
        toolId: 'black-forest-labs/flux',
        unitType: 'images',
        costPerUnitUsd: 0.11,
      }),
    )
    expect(result).toEqual({
      aiPricingUpdatedModels: 8,
      replicatePricingReady: true,
    })
  })
})
