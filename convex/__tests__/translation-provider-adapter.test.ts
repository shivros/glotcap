import { describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { ConvexTranslationProviderAdapter } from '../mediaTools/infrastructure/translationProviderAdapter'

const translateMock = vi.hoisted(() => vi.fn())

vi.mock('../translation_service', () => ({
  createTranslationService: () => ({
    translate: translateMock,
  }),
}))

describe('ConvexTranslationProviderAdapter', () => {
  it('returns translated text on successful attempt', async () => {
    translateMock.mockResolvedValueOnce({
      status: 'ok',
      text: 'hello',
    })

    const adapter = new ConvexTranslationProviderAdapter()
    const result = await adapter.translateSegment({
      text: 'hola',
      sourceLanguage: 'es',
      targetLanguage: 'en',
    })

    expect(result).toBe('hello')
  })

  it('throws ConvexError when translation attempt fails', async () => {
    translateMock.mockResolvedValueOnce({
      status: 'error',
      text: '',
      error: new Error('provider failed'),
    })

    const adapter = new ConvexTranslationProviderAdapter()

    await expect(
      adapter.translateSegment({
        text: 'hola',
        targetLanguage: 'en',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })
})
