// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNeutralCostRecorder } from './neutralCostRecorder'

const addAICostRecordMock = vi.fn()
const addToolCostRecordMock = vi.fn()
const refreshAIPricingMock = vi.fn()
const getToolPricingByIdMock = vi.fn()
const upsertUnitsToolPricingMock = vi.fn()

vi.mock('./neutralCostGateway', () => ({
  addAICostRecord: (...args: Array<unknown>) => addAICostRecordMock(...args),
  addToolCostRecord: (...args: Array<unknown>) =>
    addToolCostRecordMock(...args),
  refreshAIPricing: (...args: Array<unknown>) => refreshAIPricingMock(...args),
  getToolPricingById: (...args: Array<unknown>) =>
    getToolPricingByIdMock(...args),
  upsertUnitsToolPricing: (...args: Array<unknown>) =>
    upsertUnitsToolPricingMock(...args),
}))

describe('NeutralCostRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes AI pricing and suppresses a second missing-pricing miss', async () => {
    addAICostRecordMock
      .mockRejectedValueOnce(new Error('Pricing not found for model'))
      .mockRejectedValueOnce(new Error('Pricing not found for model'))
    refreshAIPricingMock.mockResolvedValueOnce({ updatedModels: 5 })
    const recorder = createNeutralCostRecorder()
    const ctx = {} as any

    await recorder.recordAICost(ctx, {
      messageId: 'msg_1',
      threadId: 'thread_1',
      userId: 'user_1',
      providerId: 'openrouter',
      modelId: 'openrouter/auto',
      usage: { promptTokens: 10, completionTokens: 12, totalTokens: 22 },
    })

    expect(addAICostRecordMock).toHaveBeenCalledTimes(2)
    expect(refreshAIPricingMock).toHaveBeenCalledTimes(1)
    const refreshRequest = refreshAIPricingMock.mock.calls[0]?.[1]
    expect(refreshRequest).toEqual(
      expect.objectContaining({
        reason: 'missing_pricing_retry',
        scope: expect.objectContaining({
          type: 'openrouterUserModels',
          endpoint: '/api/v1/models/user',
        }),
      }),
    )
  })

  it('upserts tool pricing and suppresses pricing failures in best-effort mode', async () => {
    addToolCostRecordMock
      .mockRejectedValueOnce(new Error('Pricing not found for tool'))
      .mockRejectedValueOnce(new Error('Pricing not found for tool'))
    getToolPricingByIdMock.mockResolvedValueOnce(null)
    upsertUnitsToolPricingMock.mockResolvedValueOnce('pricing_1')
    const recorder = createNeutralCostRecorder()
    const ctx = {} as any

    await recorder.recordToolCost(ctx, {
      messageId: 'msg_2',
      threadId: 'thread_1',
      userId: 'user_1',
      providerId: 'replicate',
      toolId: 'flux',
    })

    expect(getToolPricingByIdMock).toHaveBeenCalledWith(ctx, {
      providerId: 'replicate',
      toolId: 'flux',
    })
    expect(upsertUnitsToolPricingMock).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        providerId: 'replicate',
        providerName: 'replicate',
        toolId: 'flux',
        unitType: 'units',
        costPerUnitUsd: 0.01,
      }),
    )
    expect(addToolCostRecordMock).toHaveBeenCalledTimes(2)
  })

  it('does not block on non-pricing failures in best-effort mode', async () => {
    addAICostRecordMock.mockRejectedValueOnce(new Error('boom'))
    addToolCostRecordMock.mockRejectedValueOnce(new Error('boom'))
    const recorder = createNeutralCostRecorder()

    await expect(
      recorder.recordAICost({} as any, {
        messageId: 'msg_ai',
        threadId: 'thread',
        providerId: 'openrouter',
        modelId: 'openai/gpt-4o-mini',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    ).resolves.toBeUndefined()
    await expect(
      recorder.recordToolCost({} as any, {
        messageId: 'msg_tool',
        threadId: 'thread',
        providerId: 'replicate',
        toolId: 'flux',
      }),
    ).resolves.toBeUndefined()
  })

  it('supports strict policy override for fail-fast callers', async () => {
    addAICostRecordMock.mockRejectedValueOnce(new Error('boom'))
    const recorder = createNeutralCostRecorder({
      defaultFailurePolicy: 'strict',
    })

    await expect(
      recorder.recordAICost({} as any, {
        messageId: 'msg_ai_strict',
        threadId: 'thread',
        providerId: 'openrouter',
        modelId: 'openai/gpt-4o-mini',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }),
    ).rejects.toMatchObject({
      name: 'CostWriteFailureError',
    })
  })
})
