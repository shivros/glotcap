// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestElevenLabsSpeechStreamMock = vi.hoisted(() => vi.fn())
const parseTtsProviderNameMock = vi.hoisted(() => vi.fn())
const recordTtsCostMock = vi.hoisted(() => vi.fn())
const runActionMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/speech/tts', () => ({
  requestElevenLabsSpeechStream: (...args: Array<unknown>) =>
    requestElevenLabsSpeechStreamMock(...args),
}))

vi.mock('ts-common/speech/tts/config/resolve-tts-config', () => ({
  parseTtsProviderName: (...args: Array<unknown>) =>
    parseTtsProviderNameMock(...args),
}))

vi.mock('../_generated/server', () => ({
  httpAction: (handler: unknown) => handler,
}))

vi.mock('../_generated/api', () => ({
  api: { tts: { synthesize: 'tts:synthesize' } },
}))

vi.mock('../costs', () => ({
  createCostRuntime: () => ({
    toolUsageCostService: {
      recordTtsCost: (...args: Array<unknown>) => recordTtsCostMock(...args),
    },
  }),
}))

const makeRequest = (body: Record<string, unknown>) =>
  new Request('https://example.com/tts-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const makeCtx = () =>
  ({
    runAction: runActionMock,
  }) as any

describe('tts stream handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    parseTtsProviderNameMock.mockReturnValue(undefined)
  })

  it('returns 400 when text is missing', async () => {
    const module = (await import('../ttsStream')) as any
    const response = await module.stream(makeCtx(), makeRequest({}))

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Missing text')
  })

  it('returns 400 when text has no speakable content after preprocessing', async () => {
    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: '😀 🎉' }),
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe(
      'Text contains no speakable content after preprocessing.',
    )
  })

  it('uses preprocessed text for ElevenLabs streaming and cost tracking', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID', 'voice-1')
    requestElevenLabsSpeechStreamMock.mockResolvedValueOnce({
      stream: new ReadableStream(),
      mimeType: 'audio/mpeg',
    })
    recordTtsCostMock.mockResolvedValueOnce(undefined)

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hola 😀' }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(requestElevenLabsSpeechStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hola',
      }),
    )
    expect(recordTtsCostMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        text: 'Hola',
      }),
    )
  })

  it('keeps stream success when cost recording fails after a successful provider response', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID', 'voice-1')
    requestElevenLabsSpeechStreamMock.mockResolvedValueOnce({
      stream: new ReadableStream(),
      mimeType: 'audio/mpeg',
    })
    recordTtsCostMock.mockRejectedValueOnce(new Error('cost backend down'))
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hola 😀' }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record ElevenLabs streaming cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('returns 400 when ElevenLabs provider is selected but voice config is missing', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID', '')

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hola' }),
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Missing ElevenLabs configuration')
  })

  it('returns 502 and continues when cost recording fails in ElevenLabs error handling', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID', 'voice-1')
    requestElevenLabsSpeechStreamMock.mockRejectedValueOnce(
      new Error('provider failed'),
    )
    recordTtsCostMock.mockRejectedValueOnce(new Error('cost recorder failed'))
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hola' }),
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('provider failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record ElevenLabs streaming cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('uses preprocessed text for synthesize fallback', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    runActionMock.mockResolvedValueOnce({
      audioBase64: 'YXVkaW8=',
      mimeType: 'audio/wav',
    })

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hello 🎉' }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
    expect(runActionMock).toHaveBeenCalledWith('tts:synthesize', {
      text: 'Hello',
      provider: undefined,
      voiceId: undefined,
      modelId: undefined,
      languageCode: undefined,
      outputFormat: undefined,
      sampleRateHertz: undefined,
      prompt: undefined,
      optimizeStreamingLatency: undefined,
    })
  })

  it('returns 502 fallback message when synthesize fallback fails with a non-Error', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    runActionMock.mockRejectedValueOnce('not-an-error')

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hello 🎉' }),
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('TTS streaming failed.')
  })

  it('uses injected preprocessor via createStreamHandler', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    runActionMock.mockResolvedValueOnce({
      audioBase64: 'YXVkaW8=',
      mimeType: 'audio/wav',
    })
    const preprocessor = vi.fn((text: string) => ({
      ok: true as const,
      text: `custom:${text}`,
    }))

    const module = (await import('../ttsStream')) as any
    const handler = module.createStreamHandler({ preprocessor })
    const response = await handler(makeCtx(), makeRequest({ text: 'Hello' }))

    expect(response.status).toBe(200)
    expect(preprocessor).toHaveBeenCalledWith('Hello')
    expect(runActionMock).toHaveBeenCalledWith('tts:synthesize', {
      text: 'custom:Hello',
      provider: undefined,
      voiceId: undefined,
      modelId: undefined,
      languageCode: undefined,
      outputFormat: undefined,
      sampleRateHertz: undefined,
      prompt: undefined,
      optimizeStreamingLatency: undefined,
    })
  })

  it('resolves explicit default provider from env before provider fallback', async () => {
    vi.stubEnv('TTS_PROVIDER', 'google_cloud_tts')
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    parseTtsProviderNameMock.mockImplementation((value: unknown) =>
      value === 'google_cloud_tts' ? 'google_cloud_tts' : undefined,
    )
    runActionMock.mockResolvedValueOnce({
      audioBase64: 'YXVkaW8=',
      mimeType: 'audio/wav',
    })

    const module = (await import('../ttsStream')) as any
    const response = await module.stream(
      makeCtx(),
      makeRequest({ text: 'Hello' }),
    )

    expect(response.status).toBe(200)
    expect(requestElevenLabsSpeechStreamMock).not.toHaveBeenCalled()
    expect(runActionMock).toHaveBeenCalledWith(
      'tts:synthesize',
      expect.objectContaining({
        text: 'Hello',
      }),
    )
  })
})
