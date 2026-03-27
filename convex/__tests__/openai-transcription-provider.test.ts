import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { OpenAiTranscriptionProvider } from '../mediaTools/infrastructure/openAiTranscriptionProvider'

const originalEnv = { ...process.env }

describe('OpenAiTranscriptionProvider', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.WHISPER_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    delete process.env.WHISPER_API_BASE
    delete process.env.WHISPER_MODEL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('throws when no api key is configured', async () => {
    const provider = new OpenAiTranscriptionProvider()

    await expect(
      provider.transcribe({
        blob: new Blob(['abc'], { type: 'audio/mpeg' }),
        fileName: 'audio.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('throws TRANSCRIPTION_FAILED on non-2xx responses', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('bad request', { status: 400 })),
      ),
    )
    const provider = new OpenAiTranscriptionProvider()

    await expect(
      provider.transcribe({
        blob: new Blob(['abc'], { type: 'audio/mpeg' }),
        fileName: 'audio.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('throws when provider returns empty transcript text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ text: '', segments: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const provider = new OpenAiTranscriptionProvider()

    await expect(
      provider.transcribe({
        blob: new Blob(['abc'], { type: 'audio/mpeg' }),
        fileName: 'audio.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('coerces transcript and fallback segment when segments are missing', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ text: 'hello world' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    const provider = new OpenAiTranscriptionProvider()

    const result = await provider.transcribe({
      blob: new Blob(['abc'], { type: 'audio/mpeg' }),
      fileName: 'audio.mp3',
    })

    expect(result.transcript).toBe('hello world')
    expect(result.segments).toEqual([
      {
        segmentIndex: 1,
        originalText: 'hello world',
      },
    ])
  })

  it('maps verbose segment timestamps to milliseconds', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              text: 'hello world',
              segments: [{ text: 'hello', start: 1.5, end: 2.75 }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      ),
    )
    const provider = new OpenAiTranscriptionProvider()

    const result = await provider.transcribe({
      blob: new Blob(['abc'], { type: 'audio/mpeg' }),
      fileName: 'audio.mp3',
      sourceLanguage: 'en',
    })

    expect(result.segments[0]).toMatchObject({
      segmentIndex: 1,
      originalText: 'hello',
      startMs: 1500,
      endMs: 2750,
    })
  })
})
