// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAICostRecord,
  addToolCostRecord,
  getToolPricingById,
  refreshAIPricing,
  upsertUnitsToolPricing,
} from './neutralCostGateway'

const addAICostMock = vi.hoisted(() => vi.fn())
const addToolCostMock = vi.hoisted(() => vi.fn())
const updatePricingDataMock = vi.hoisted(() => vi.fn())
const getToolPricingMock = vi.hoisted(() => vi.fn())

vi.mock('neutral-cost', () => ({
  CostComponent: class {
    addAICost = (...args: Array<unknown>) => addAICostMock(...args)
    addToolCost = (...args: Array<unknown>) => addToolCostMock(...args)
    updatePricingData = (...args: Array<unknown>) =>
      updatePricingDataMock(...args)
    getToolPricing = (...args: Array<unknown>) => getToolPricingMock(...args)
  },
}))

vi.mock('../_generated/api', () => ({
  components: {
    neutralCost: {
      pricing: {
        upsertToolPricing: 'components.neutralCost.pricing.upsertToolPricing',
      },
    },
  },
}))

describe('neutralCostGateway', () => {
  const originalModelsDevApiKey = process.env.MODELS_DEV_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.MODELS_DEV_API_KEY
  })

  afterEach(() => {
    if (originalModelsDevApiKey === undefined) {
      delete process.env.MODELS_DEV_API_KEY
    } else {
      process.env.MODELS_DEV_API_KEY = originalModelsDevApiKey
    }
  })

  it('delegates addAICostRecord and addToolCostRecord to cost component', async () => {
    const ctx = { runMutation: vi.fn() } as any
    addAICostMock.mockResolvedValueOnce('ai_1')
    addToolCostMock.mockResolvedValueOnce('tool_1')

    await addAICostRecord(ctx, {
      messageId: 'msg_1',
      threadId: 'thread_1',
      providerId: 'openrouter',
      modelId: 'openrouter/auto',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    })
    await addToolCostRecord(ctx, {
      messageId: 'msg_2',
      threadId: 'thread_1',
      providerId: 'replicate',
      toolId: 'flux',
      units: 1,
      unitType: 'images',
    })

    expect(addAICostMock).toHaveBeenCalledTimes(1)
    expect(addAICostMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        messageId: 'msg_1',
        modelId: 'openrouter/auto',
      }),
    )
    expect(addToolCostMock).toHaveBeenCalledTimes(1)
    expect(addToolCostMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        messageId: 'msg_2',
        toolId: 'flux',
      }),
    )
  })

  it('refreshes pricing with optional MODELS_DEV_API_KEY', async () => {
    const ctx = {} as any
    updatePricingDataMock.mockResolvedValue({ updatedModels: 7 })

    await refreshAIPricing(ctx)
    expect(updatePricingDataMock).toHaveBeenLastCalledWith(ctx, undefined)

    process.env.MODELS_DEV_API_KEY = 'models-key'
    await refreshAIPricing(ctx)
    expect(updatePricingDataMock).toHaveBeenLastCalledWith(ctx, {
      MODELS_DEV_API_KEY: 'models-key',
    })
  })

  it('normalizes ids for getToolPricing and upsert mutation payload', async () => {
    const runMutation = vi.fn(() => Promise.resolve('pricing_1'))
    const ctx = { runMutation } as any
    getToolPricingMock.mockResolvedValueOnce({ _id: 'pricing_1' })

    await getToolPricingById(ctx, {
      providerId: ' Replicate ',
      toolId: ' Flux ',
    })
    await upsertUnitsToolPricing(ctx, {
      providerId: ' Replicate ',
      providerName: 'Replicate',
      toolId: ' Flux ',
      unitType: 'images',
      costPerUnitUsd: 0.04,
    })

    expect(getToolPricingMock).toHaveBeenCalledWith(ctx, 'replicate', 'flux')
    expect(runMutation).toHaveBeenCalledWith(
      'components.neutralCost.pricing.upsertToolPricing',
      expect.objectContaining({
        providerId: 'replicate',
        modelId: 'flux',
        modelName: 'flux',
        pricing: expect.objectContaining({
          costPerUnit: 0.04,
          unitType: 'images',
        }),
      }),
    )
  })
})
