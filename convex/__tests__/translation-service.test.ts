import { describe, expect, it } from 'vitest'
import { TranslationService } from '../translation_service'

const streamChunks = (chunks: Array<string>, error?: unknown) =>
  (async function* () {
    for (const chunk of chunks) {
      await Promise.resolve()
      yield chunk
    }
    if (error) {
      throw error
    }
  })()

describe('TranslationService', () => {
  it('translates successfully and reports timings', async () => {
    const service = new TranslationService({
      resolveModel: (override) => override ?? 'fallback-model',
      createClient: () => ({
        stream: () => streamChunks(['hello ', 'world']),
      }),
      now: (() => {
        const values = [1000, 1080, 1200]
        return () => values.shift() ?? 1200
      })(),
    })

    const result = await service.translate({
      text: 'hola mundo',
      sourceLanguage: 'Spanish',
      targetLanguage: 'English',
      model: 'test-model',
    })

    expect(result.status).toBe('ok')
    expect(result.text).toBe('hello world')
    expect(result.model).toBe('test-model')
    expect(result.timings).toEqual({
      ttftMs: 80,
      totalMs: 200,
      chunkCount: 2,
    })
    expect(result.error).toBeUndefined()
  })

  it('returns an error attempt with partial output when the provider fails', async () => {
    const service = new TranslationService({
      resolveModel: () => 'fallback-model',
      createClient: () => ({
        stream: () => streamChunks(['partial '], new Error('stream failed')),
      }),
      now: (() => {
        const values = [2000, 2050, 2130]
        return () => values.shift() ?? 2130
      })(),
    })

    const result = await service.translate({
      text: 'bonjour',
      targetLanguage: 'English',
    })

    expect(result.status).toBe('error')
    expect(result.text).toBe('partial')
    expect(result.timings).toEqual({
      ttftMs: 50,
      totalMs: 130,
      chunkCount: 1,
    })
    expect(result.error).toBeInstanceOf(Error)
  })
})
