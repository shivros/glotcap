// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  resolveImageCostProviderId,
  resolveLlmCostProviderId,
  resolveSttCostProviderId,
  resolveTtsCostProviderId,
} from './providerPolicy'

describe('providerPolicy', () => {
  it('prefers explicit llm provider name', () => {
    expect(
      resolveLlmCostProviderId({
        providerName: 'OpenAI',
        modelId: 'openrouter/auto',
      }),
    ).toBe('openai')
  })

  it('infers llm provider from model id prefix', () => {
    expect(
      resolveLlmCostProviderId({
        modelId: 'anthropic/claude-3.7-sonnet',
      }),
    ).toBe('anthropic')
  })

  it('falls back to default llm provider', () => {
    expect(
      resolveLlmCostProviderId({
        modelId: 'gpt-4o-mini',
      }),
    ).toBe('openrouter')
  })

  it('resolves image, tts, and stt providers with explicit override and defaults', () => {
    expect(resolveImageCostProviderId('Replicate')).toBe('replicate')
    expect(resolveImageCostProviderId()).toBe('replicate')

    expect(resolveTtsCostProviderId('Google_Cloud_TTS')).toBe(
      'google_cloud_tts',
    )
    expect(resolveTtsCostProviderId()).toBe('elevenlabs')

    expect(resolveSttCostProviderId('Deepgram')).toBe('deepgram')
    expect(resolveSttCostProviderId()).toBe('soniox')
  })
})
