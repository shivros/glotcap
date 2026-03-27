// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  resolveToolPricingUpsertArgs,
  resolveUnitCostPerUnitUsd,
} from './pricingDefaults'

const ORIGINAL_ENV = {
  REPLICATE_IMAGE_COST_PER_IMAGE_USD:
    process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD,
  LLM_CHARACTER_COST_PER_CHARACTER_USD:
    process.env.LLM_CHARACTER_COST_PER_CHARACTER_USD,
  TTS_CHARACTER_COST_PER_CHARACTER_USD:
    process.env.TTS_CHARACTER_COST_PER_CHARACTER_USD,
  STT_COST_PER_AUDIO_SECOND_USD: process.env.STT_COST_PER_AUDIO_SECOND_USD,
  STT_COST_PER_SESSION_USD: process.env.STT_COST_PER_SESSION_USD,
  TOOL_DEFAULT_COST_PER_UNIT_USD: process.env.TOOL_DEFAULT_COST_PER_UNIT_USD,
}

const restoreEnv = (key: keyof typeof ORIGINAL_ENV) => {
  const value = ORIGINAL_ENV[key]
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

describe('pricingDefaults', () => {
  beforeEach(() => {
    delete process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD
    delete process.env.LLM_CHARACTER_COST_PER_CHARACTER_USD
    delete process.env.TTS_CHARACTER_COST_PER_CHARACTER_USD
    delete process.env.STT_COST_PER_AUDIO_SECOND_USD
    delete process.env.STT_COST_PER_SESSION_USD
    delete process.env.TOOL_DEFAULT_COST_PER_UNIT_USD
  })

  afterEach(() => {
    restoreEnv('REPLICATE_IMAGE_COST_PER_IMAGE_USD')
    restoreEnv('LLM_CHARACTER_COST_PER_CHARACTER_USD')
    restoreEnv('TTS_CHARACTER_COST_PER_CHARACTER_USD')
    restoreEnv('STT_COST_PER_AUDIO_SECOND_USD')
    restoreEnv('STT_COST_PER_SESSION_USD')
    restoreEnv('TOOL_DEFAULT_COST_PER_UNIT_USD')
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

  it('builds normalized tool upsert args from tool record input', () => {
    const upsertArgs = resolveToolPricingUpsertArgs({
      messageId: 'msg_1',
      threadId: 'thread_1',
      providerId: ' Replicate ',
      toolId: ' Flux ',
      unitType: 'images ',
    })

    expect(upsertArgs).toEqual({
      providerId: 'replicate',
      providerName: 'Replicate',
      toolId: 'flux',
      unitType: 'images',
      costPerUnitUsd: 0.04,
    })
  })
})
