import { describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { MediaToolInputLoader } from '../mediaTools/infrastructure/inputLoader'

describe('MediaToolInputLoader', () => {
  it('throws NOT_FOUND when storage blob is missing', async () => {
    const loader = new MediaToolInputLoader({
      getBlob: vi.fn(() => Promise.resolve(null)),
      transcriptionProvider: {
        transcribe: vi.fn(),
      },
    })

    await expect(
      loader.load({
        storageId: 'storage-1' as any,
        fileName: 'audio.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('parses srt input and skips transcription provider', async () => {
    const transcribe = vi.fn()
    const loader = new MediaToolInputLoader({
      getBlob: vi.fn(() =>
        Promise.resolve(
          new Blob(
            [
              '1\n00:00:00,000 --> 00:00:01,000\nHola\n\n2\n00:00:01,100 --> 00:00:02,000\nMundo',
            ],
            { type: 'application/x-subrip' },
          ),
        ),
      ),
      transcriptionProvider: {
        transcribe,
      },
    })

    const result = await loader.load({
      storageId: 'storage-1' as any,
      fileName: 'captions.srt',
    })

    expect(result.segments).toHaveLength(2)
    expect(result.transcript).toBe('Hola\nMundo')
    expect(transcribe).not.toHaveBeenCalled()
  })

  it('throws INVALID_INPUT for malformed srt content', async () => {
    const loader = new MediaToolInputLoader({
      getBlob: vi.fn(() =>
        Promise.resolve(new Blob(['not a valid srt'], { type: 'text/plain' })),
      ),
      transcriptionProvider: {
        transcribe: vi.fn(),
      },
    })

    await expect(
      loader.load({
        storageId: 'storage-1' as any,
        fileName: 'captions.srt',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('delegates non-srt input to transcription provider', async () => {
    const transcribe = vi.fn(() =>
      Promise.resolve({
        transcript: 'hello',
        segments: [{ segmentIndex: 1, originalText: 'hello' }],
      }),
    )
    const loader = new MediaToolInputLoader({
      getBlob: vi.fn(() =>
        Promise.resolve(new Blob(['binary data'], { type: 'audio/mpeg' })),
      ),
      transcriptionProvider: {
        transcribe,
      },
    })

    const result = await loader.load({
      storageId: 'storage-1' as any,
      fileName: 'audio.mp3',
      sourceLanguage: 'en',
    })

    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'audio.mp3',
        sourceLanguage: 'en',
      }),
    )
    expect(result.transcript).toBe('hello')
  })
})
