import { describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { CostTrackingTranscriptionProvider } from '../mediaTools/infrastructure/costTrackingTranscriptionProvider'
import { CostTrackingTranslationProvider } from '../mediaTools/infrastructure/costTrackingTranslationProvider'

describe('cost tracking provider decorators', () => {
  it('records transcription cost on success and error', async () => {
    const recordTranscriptionCost = vi.fn(async () => {})
    const baseProvider = {
      transcribe: vi
        .fn()
        .mockResolvedValueOnce({
          transcript: 'hello world',
          segments: [
            {
              segmentIndex: 1,
              startMs: 0,
              endMs: 1800,
              originalText: 'hello world',
            },
          ],
        })
        .mockRejectedValueOnce(
          new ConvexError({ code: 'TRANSCRIPTION_FAILED' }),
        ),
    }

    const provider = new CostTrackingTranscriptionProvider({
      provider: baseProvider,
      ctx: {} as any,
      toolUsageCostService: {
        recordTranscriptionCost,
      } as any,
      threadId: 'media-tools:job_1',
      providerName: 'openai',
      modelIdResolver: () => 'whisper-1',
    })

    const success = await provider.transcribe({
      blob: new Blob(['abc']),
      fileName: 'audio.mp3',
    })

    expect(success.transcript).toBe('hello world')
    expect(recordTranscriptionCost).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        threadId: 'media-tools:job_1',
        modelId: 'whisper-1',
        metadata: expect.objectContaining({ status: 'ok' }),
      }),
    )

    await expect(
      provider.transcribe({
        blob: new Blob(['def']),
        fileName: 'audio2.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)

    expect(recordTranscriptionCost).toHaveBeenCalledTimes(2)
    expect((recordTranscriptionCost as any).mock.calls[1][1]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ status: 'error' }),
      }),
    )
  })

  it('records translation cost on success and error', async () => {
    const recordLlmStreamCost = vi.fn(async () => {})
    const baseProvider = {
      translateSegment: vi
        .fn()
        .mockResolvedValueOnce('hello')
        .mockRejectedValueOnce(new ConvexError({ code: 'TRANSLATION_FAILED' })),
    }

    const provider = new CostTrackingTranslationProvider({
      provider: baseProvider,
      ctx: {} as any,
      toolUsageCostService: {
        recordLlmStreamCost,
      } as any,
      threadId: 'media-tools:job_2',
      providerNameResolver: () => 'openrouter',
      modelIdResolver: () => 'openrouter/auto',
    })

    const text = await provider.translateSegment({
      text: 'hola',
      sourceLanguage: 'es',
      targetLanguage: 'en',
    })
    expect(text).toBe('hello')

    await expect(
      provider.translateSegment({
        text: 'hola otra vez',
        targetLanguage: 'en',
      }),
    ).rejects.toBeInstanceOf(ConvexError)

    expect(recordLlmStreamCost).toHaveBeenCalledTimes(2)
    expect((recordLlmStreamCost as any).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        modelId: 'openrouter/auto',
        providerName: 'openrouter',
        metadata: expect.objectContaining({ status: 'ok' }),
      }),
    )
    expect((recordLlmStreamCost as any).mock.calls[1][1]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ status: 'error' }),
      }),
    )
  })
})
