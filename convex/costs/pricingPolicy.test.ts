// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureToolPricing,
  isMissingPricingError,
  resolveAIPricingRefreshRequest,
  resolveToolPricingUpsertArgs,
  resolveUnitCostPerUnitUsd,
} from './pricingPolicy'

const getToolPricingByIdMock = vi.fn()
const upsertUnitsToolPricingMock = vi.fn()

vi.mock('./neutralCostGateway', () => ({
  getToolPricingById: (...args: Array<unknown>) =>
    getToolPricingByIdMock(...args),
  upsertUnitsToolPricing: (...args: Array<unknown>) =>
    upsertUnitsToolPricingMock(...args),
  refreshAIPricing: vi.fn(),
}))

describe('pricingPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD
    delete process.env.LLM_CHARACTER_COST_PER_CHARACTER_USD
    delete process.env.TTS_CHARACTER_COST_PER_CHARACTER_USD
    delete process.env.STT_COST_PER_AUDIO_SECOND_USD
    delete process.env.STT_COST_PER_SESSION_USD
    delete process.env.TOOL_DEFAULT_COST_PER_UNIT_USD
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects missing pricing errors for model and tool', () => {
    expect(
      isMissingPricingError(new Error('Pricing not found for model'), 'model'),
    ).toBe(true)
    expect(
      isMissingPricingError(new Error('Pricing not found for tool'), 'tool'),
    ).toBe(true)
    expect(isMissingPricingError(new Error('boom'), 'tool')).toBe(false)
  })

  it('returns default unit costs and reads env overrides', () => {
    expect(resolveUnitCostPerUnitUsd('images')).toBe(0.04)
    expect(resolveUnitCostPerUnitUsd('characters')).toBe(0.000002)
    expect(resolveUnitCostPerUnitUsd('audio_seconds')).toBe(0.0002)
    expect(resolveUnitCostPerUnitUsd('sessions')).toBe(0.002)
    expect(resolveUnitCostPerUnitUsd('units')).toBe(0.01)

    process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD = '0.12'
    process.env.LLM_CHARACTER_COST_PER_CHARACTER_USD = '0.0005'
    process.env.STT_COST_PER_AUDIO_SECOND_USD = '0.001'
    process.env.STT_COST_PER_SESSION_USD = '0.015'
    process.env.TOOL_DEFAULT_COST_PER_UNIT_USD = '0.2'

    expect(resolveUnitCostPerUnitUsd('images')).toBe(0.12)
    expect(resolveUnitCostPerUnitUsd('characters')).toBe(0.0005)
    expect(resolveUnitCostPerUnitUsd('audio_seconds')).toBe(0.001)
    expect(resolveUnitCostPerUnitUsd('sessions')).toBe(0.015)
    expect(resolveUnitCostPerUnitUsd('units')).toBe(0.2)
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

  it('delegates refresh scope and tool upsert helpers for legacy imports', () => {
    const refreshRequest = resolveAIPricingRefreshRequest({
      messageId: 'msg_1',
      threadId: 'thread_1',
      providerId: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })
    expect(refreshRequest).toEqual(
      expect.objectContaining({
        reason: 'missing_pricing_retry',
      }),
    )

    const upsertArgs = resolveToolPricingUpsertArgs({
      messageId: 'msg_2',
      threadId: 'thread_1',
      providerId: 'replicate',
      toolId: 'flux',
    })
    expect(upsertArgs).toEqual(
      expect.objectContaining({
        providerId: 'replicate',
        toolId: 'flux',
      }),
    )
  })
})
