// @vitest-environment node
import { ConvexError } from 'convex/values'
import { TtsError } from 'ts-common/speech/tts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeSynthesizeMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/speech/tts/config', () => ({
  createTtsRuntimeFromEnv: () => ({
    synthesize: runtimeSynthesizeMock,
  }),
}))

describe('createSynthesizeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records tts cost on success', async () => {
    runtimeSynthesizeMock.mockResolvedValueOnce({
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
    })

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(async () => {})
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    const result = await handler({} as any, {
      text: 'hello',
      provider: 'elevenlabs',
    })

    expect(recordTtsCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: 'tts-synthesize',
        text: 'hello',
      }),
    )
    expect(result).toEqual(expect.objectContaining({ mimeType: 'audio/mpeg' }))
  })

  it('returns synthesized audio even when success-path cost recording fails', async () => {
    runtimeSynthesizeMock.mockResolvedValueOnce({
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
    })
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(() =>
      Promise.reject(new Error('cost service down')),
    )
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    const result = await handler({} as any, {
      text: 'hello',
      provider: 'elevenlabs',
    })

    expect(result).toEqual(expect.objectContaining({ mimeType: 'audio/mpeg' }))
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record TTS cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('records error cost and throws ConvexError on failure', async () => {
    runtimeSynthesizeMock.mockRejectedValueOnce(new Error('tts failed'))

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(async () => {})
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    await expect(
      handler({} as any, {
        text: 'hello',
        provider: 'elevenlabs',
      }),
    ).rejects.toBeInstanceOf(ConvexError)

    expect(recordTtsCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ status: 'error' }),
      }),
    )
  })

  it('rejects emoji-only text before runtime and cost recording', async () => {
    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(async () => {})
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    let caught: unknown = null
    try {
      await handler({} as any, {
        text: '😀 🎉',
        provider: 'elevenlabs',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ConvexError)
    expect(caught).toMatchObject({
      data: expect.objectContaining({
        code: 'TTS_TEXT_EMPTY',
      }),
    })
    expect(runtimeSynthesizeMock).not.toHaveBeenCalled()
    expect(recordTtsCost).not.toHaveBeenCalled()
  })

  it('uses injected preprocessor in the synth handler', async () => {
    runtimeSynthesizeMock.mockResolvedValueOnce({
      audio: new Uint8Array([7]),
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
    })
    const preprocessor = vi.fn((text: string) => ({
      ok: true as const,
      text: `custom:${text}`,
    }))

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(async () => {})
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
      preprocessor,
    })

    await handler({} as any, {
      text: 'hello',
      provider: 'elevenlabs',
    })

    expect(preprocessor).toHaveBeenCalledWith('hello')
    expect(runtimeSynthesizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'custom:hello',
      }),
    )
    expect(recordTtsCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        text: 'custom:hello',
      }),
    )
  })

  it('maps TtsError to a ConvexError with provider code/message', async () => {
    runtimeSynthesizeMock.mockRejectedValueOnce(
      new TtsError({
        code: 'TTS_CONFIG_MISSING',
        provider: 'elevenlabs',
        message: 'missing voice',
      }),
    )

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(async () => {})
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    let caught: unknown = null
    try {
      await handler({} as any, {
        text: 'hello',
        provider: 'elevenlabs',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ConvexError)
    expect(caught).toMatchObject({
      data: expect.objectContaining({
        code: 'TTS_CONFIG_MISSING',
        message: 'missing voice',
      }),
    })
    expect(recordTtsCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ status: 'error' }),
      }),
    )
  })

  it('still throws ConvexError when cost recording fails inside error handling', async () => {
    runtimeSynthesizeMock.mockRejectedValueOnce(new Error('runtime exploded'))
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { createSynthesizeHandler } = await import('../tts')
    const recordTtsCost = vi.fn(() =>
      Promise.reject(new Error('cost service down')),
    )
    const handler = createSynthesizeHandler({
      toolUsageCostService: { recordTtsCost } as any,
    })

    let caught: unknown = null
    try {
      await handler({} as any, {
        text: 'hello',
        provider: 'elevenlabs',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ConvexError)
    expect(caught).toMatchObject({
      data: expect.objectContaining({
        code: 'TTS_REQUEST_FAILED',
        message: 'runtime exploded',
      }),
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record TTS cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })
})
