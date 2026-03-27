// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const translateMock = vi.hoisted(() => vi.fn())

vi.mock('../translation_service', () => ({
  createTranslationService: () => ({
    translate: translateMock,
  }),
}))

describe('createTranslateSegmentHandler', () => {
  it('records streaming cost and returns translated payload', async () => {
    translateMock.mockResolvedValueOnce({
      status: 'ok',
      text: 'hello',
      model: 'openrouter/auto',
      timings: { totalMs: 10, chunkCount: 1 },
    })

    const { createTranslateSegmentHandler } = await import('../translations')

    const recordLlmStreamCost = vi.fn(() => Promise.resolve())
    const handler = createTranslateSegmentHandler({
      toolUsageCostService: { recordLlmStreamCost } as any,
    })

    const ctx = {
      runMutation: vi.fn(() => Promise.resolve(null)),
    } as any

    const result = await handler(ctx, {
      text: 'hola',
      targetLanguage: 'en',
      sessionId: 'session_1',
    })

    expect(recordLlmStreamCost).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        operation: 'speaking-translation-segment',
        threadId: 'speaking:session_1',
        inputText: 'hola',
        outputText: 'hello',
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        text: 'hello',
        model: 'openrouter/auto',
      }),
    )
  })

  it('throws provider errors after recording error status', async () => {
    const providerError = new Error('translation failed')
    translateMock.mockResolvedValueOnce({
      status: 'error',
      text: '',
      model: 'openrouter/auto',
      timings: { totalMs: 10, chunkCount: 1 },
      error: providerError,
    })

    const { createTranslateSegmentHandler } = await import('../translations')

    const recordLlmStreamCost = vi.fn(() => Promise.resolve())
    const handler = createTranslateSegmentHandler({
      toolUsageCostService: { recordLlmStreamCost } as any,
    })

    await expect(
      handler({ runMutation: vi.fn(() => Promise.resolve(null)) } as any, {
        text: 'hola',
        targetLanguage: 'en',
      }),
    ).rejects.toBe(providerError)

    expect(recordLlmStreamCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ status: 'error' }),
      }),
    )
  })

  it('does not block translated responses when cost recording fails', async () => {
    translateMock.mockResolvedValueOnce({
      status: 'ok',
      text: 'hello',
      model: 'openrouter/auto',
      timings: { totalMs: 10, chunkCount: 1 },
    })
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { createTranslateSegmentHandler } = await import('../translations')
    const handler = createTranslateSegmentHandler({
      toolUsageCostService: {
        recordLlmStreamCost: vi.fn(() =>
          Promise.reject(new Error('cost service down')),
        ),
      } as any,
    })

    const result = await handler(
      { runMutation: vi.fn(() => Promise.resolve(null)) } as any,
      {
        text: 'hola',
        targetLanguage: 'en',
      },
    )

    expect(result).toEqual(
      expect.objectContaining({
        text: 'hello',
      }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record translation segment cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })
})
