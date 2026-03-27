import { describe, expect, it, vi } from 'vitest'
import { createCoachTtsPort } from '@/lib/speaking-session-coach-tts-port'

describe('createCoachTtsPort', () => {
  it('streams with the expected request payload', async () => {
    const synthesizeSpeech = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>(),
      headers: new Headers({
        'Content-Type': 'audio/ogg',
      }),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {
          voiceId: 'voice-1',
          modelId: 'model-1',
          languageCode: 'es',
          outputFormat: 'mp3_44100_128',
          latencyHint: 4,
        },
        synthesizeSpeech,
      }),
    })

    const streamResult = await port.stream('hola 😀')
    const firstCall = fetchSpy.mock.calls.at(0)
    const body = JSON.parse(String(firstCall?.[1]?.body ?? '{}'))

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.test/tts-stream',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(body).toMatchObject({
      text: 'hola',
      voiceId: 'voice-1',
      modelId: 'model-1',
      languageCode: 'es',
      outputFormat: 'mp3_44100_128',
      optimizeStreamingLatency: 4,
    })
    expect(streamResult.mimeType).toBe('audio/ogg')

    fetchSpy.mockRestore()
  })

  it('throws when streaming is unavailable', async () => {
    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: null,
        ttsConfig: {},
        synthesizeSpeech: vi.fn(),
      }),
    })

    await expect(port.stream('hola')).rejects.toThrow(
      'TTS streaming unavailable.',
    )
  })

  it('surfaces stream provider errors and falls back when message is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      body: null,
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('rate limited')),
    } as unknown as Response)
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      body: null,
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {},
        synthesizeSpeech: vi.fn(),
      }),
    })

    await expect(port.stream('hola')).rejects.toThrow('rate limited')
    await expect(port.stream('hola')).rejects.toThrow('TTS streaming failed.')

    fetchSpy.mockRestore()
  })

  it('throws when streaming response has no audio body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: null,
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {},
        synthesizeSpeech: vi.fn(),
      }),
    })

    await expect(port.stream('hola')).rejects.toThrow(
      'TTS streaming response missing audio.',
    )

    fetchSpy.mockRestore()
  })

  it('returns a cancel function that aborts the stream request', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>(),
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {},
        synthesizeSpeech: vi.fn(),
      }),
    })

    const result = await port.stream('hola')
    result.cancel()

    expect(abortSpy).toHaveBeenCalledTimes(1)

    abortSpy.mockRestore()
    fetchSpy.mockRestore()
  })

  it('uses current config when synthesizing', async () => {
    let voiceId = 'voice-1'
    const synthesizeSpeech = vi.fn(() =>
      Promise.resolve({
        audioBase64: 'Zm9v',
        mimeType: 'audio/mpeg',
      }),
    )

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {
          voiceId,
          modelId: 'model-1',
          languageCode: 'es',
          outputFormat: 'mp3_44100_128',
          latencyHint: 4,
        },
        synthesizeSpeech,
      }),
    })

    await port.synthesize('hola 😀')
    voiceId = 'voice-2'
    await port.synthesize('bonjour 🎉')

    expect(synthesizeSpeech).toHaveBeenNthCalledWith(1, {
      text: 'hola',
      voiceId: 'voice-1',
      modelId: 'model-1',
      languageCode: 'es',
      outputFormat: 'mp3_44100_128',
      optimizeStreamingLatency: 4,
    })
    expect(synthesizeSpeech).toHaveBeenNthCalledWith(2, {
      text: 'bonjour',
      voiceId: 'voice-2',
      modelId: 'model-1',
      languageCode: 'es',
      outputFormat: 'mp3_44100_128',
      optimizeStreamingLatency: 4,
    })
  })

  it('throws when text is empty after preprocessing', async () => {
    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {},
        synthesizeSpeech: vi.fn(),
      }),
    })

    await expect(port.stream('😀')).rejects.toThrow(
      'TTS text empty after preprocessing.',
    )
    await expect(port.synthesize('🎉')).rejects.toThrow(
      'TTS text empty after preprocessing.',
    )
  })

  it('supports injected preprocessor and exposes prepareText', async () => {
    const preprocessor = vi.fn((text: string) =>
      text === 'skip'
        ? {
            ok: false as const,
            reason: 'empty_after_preprocessing' as const,
          }
        : {
            ok: true as const,
            text: `custom:${text}`,
          },
    )
    const synthesizeSpeech = vi.fn(() =>
      Promise.resolve({
        audioBase64: 'Zm9v',
        mimeType: 'audio/mpeg',
      }),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>(),
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const port = createCoachTtsPort({
      getConfig: () => ({
        ttsStreamUrl: new URL('https://example.test/tts-stream'),
        ttsConfig: {},
        synthesizeSpeech,
        preprocessor,
      }),
    })

    expect(port.prepareText('hola')).toBe('custom:hola')
    expect(port.prepareText('skip')).toBeNull()

    await port.stream('hola')
    await port.synthesize('bonjour')
    await expect(port.stream('skip')).rejects.toThrow(
      'TTS text empty after preprocessing.',
    )

    const firstCall = fetchSpy.mock.calls.at(0)
    const body = JSON.parse(String(firstCall?.[1]?.body ?? '{}'))
    expect(body).toMatchObject({
      text: 'custom:hola',
    })
    expect(synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'custom:bonjour',
      }),
    )
    expect(preprocessor).toHaveBeenCalled()

    fetchSpy.mockRestore()
  })
})
