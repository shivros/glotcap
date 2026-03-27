import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TtsTextPreprocessor } from '../../shared/tts-text-preprocessor'
import { useCoachPlayback } from '@/lib/speaking-session-coach-playback'

const mocks = vi.hoisted(() => {
  const playbackQueue = {
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    enqueue: vi.fn(),
    enqueueStream: vi.fn(),
  }

  const controller = {
    init: vi.fn(),
    speak: vi.fn(),
    halt: vi.fn(),
    interrupt: vi.fn(),
    reset: vi.fn(),
    isPlaying: vi.fn(() => false),
    isSpeaking: vi.fn(() => false),
  }

  let lastControllerConfig: any = null
  let autoCreatePlaybackQueueOnInit = true

  const createAudioPlaybackQueue = vi.fn(() => playbackQueue)
  const createTtsPlaybackController = vi.fn((config: any) => {
    lastControllerConfig = config
    controller.init.mockImplementation(() => {
      if (autoCreatePlaybackQueueOnInit) {
        config.createPlaybackQueue?.()
      }
    })
    return controller
  })

  return {
    playbackQueue,
    controller,
    createAudioPlaybackQueue,
    createTtsPlaybackController,
    getLastControllerConfig: () => lastControllerConfig,
    setAutoCreatePlaybackQueueOnInit: (value: boolean) => {
      autoCreatePlaybackQueueOnInit = value
    },
  }
})

vi.mock('ts-common/speech/audio', () => ({
  createAudioPlaybackQueue: mocks.createAudioPlaybackQueue,
}))

vi.mock('ts-common/speech/tts', async () => {
  const actual = await vi.importActual('ts-common/speech/tts')
  return {
    ...actual,
    createTtsPlaybackController: mocks.createTtsPlaybackController,
  }
})

const createProps = (overrides?: {
  ttsConfig?: {
    voiceId?: string
    modelId?: string
    languageCode?: string
    outputFormat?: string
    latencyHint?: number
  }
  isStopRequested?: () => boolean
  ttsTextPreprocessor?: TtsTextPreprocessor
}) => {
  const synthesizeSpeech = vi.fn(() =>
    Promise.resolve({
      audioBase64: 'Zm9v',
      mimeType: 'audio/mpeg',
    }),
  )
  const onError = vi.fn()

  return {
    ttsStreamUrl: new URL('https://example.test/tts-stream'),
    ttsConfig: {
      voiceId: 'voice-1',
      modelId: 'model-1',
      languageCode: 'es',
      outputFormat: 'mp3_44100_128',
      latencyHint: 4,
      ...overrides?.ttsConfig,
    },
    ttsTextPreprocessor: overrides?.ttsTextPreprocessor,
    synthesizeSpeech,
    isStopRequested: overrides?.isStopRequested ?? (() => false),
    onError,
  }
}

describe('useCoachPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setAutoCreatePlaybackQueueOnInit(true)
    mocks.controller.init.mockImplementation(() => {
      const config = mocks.getLastControllerConfig()
      config?.createPlaybackQueue?.()
    })
  })

  it('initializes and controls playback via the shared playback controller', () => {
    const { result } = renderHook(() => useCoachPlayback(createProps()))

    let playback: unknown = null
    act(() => {
      playback = result.current.initPlayback()
      result.current.haltPlayback()
      result.current.interruptPlayback()
      result.current.resetPlayback()
    })

    expect(mocks.createTtsPlaybackController).toHaveBeenCalledTimes(1)
    expect(mocks.controller.init).toHaveBeenCalledTimes(1)
    expect(mocks.controller.halt).toHaveBeenCalledTimes(1)
    expect(mocks.controller.interrupt).toHaveBeenCalledTimes(1)
    expect(mocks.controller.reset).toHaveBeenCalledTimes(1)
    expect(playback).toBe(mocks.playbackQueue)
  })

  it('reuses the same shared playback controller across repeated init calls', () => {
    const { result } = renderHook(() => useCoachPlayback(createProps()))

    act(() => {
      result.current.initPlayback()
      result.current.initPlayback()
    })

    expect(mocks.createTtsPlaybackController).toHaveBeenCalledTimes(1)
    expect(mocks.controller.init).toHaveBeenCalledTimes(2)
  })

  it('returns false for isPlaying before playback has been initialized', () => {
    const { result } = renderHook(() => useCoachPlayback(createProps()))
    expect(result.current.isPlaying()).toBe(false)
  })

  it('does not initialize controller when halting before playback init', () => {
    const { result } = renderHook(() => useCoachPlayback(createProps()))

    act(() => {
      result.current.haltPlayback()
    })

    expect(mocks.createTtsPlaybackController).not.toHaveBeenCalled()
    expect(mocks.controller.halt).not.toHaveBeenCalled()
  })

  it('does not initialize controller when interrupting before playback init', () => {
    const { result } = renderHook(() => useCoachPlayback(createProps()))

    act(() => {
      result.current.interruptPlayback()
    })

    expect(mocks.createTtsPlaybackController).not.toHaveBeenCalled()
    expect(mocks.controller.interrupt).not.toHaveBeenCalled()
  })

  it('does not speak when stopped or text is blank', () => {
    let stopRequested = false
    const { result } = renderHook(() =>
      useCoachPlayback(
        createProps({
          isStopRequested: () => stopRequested,
        }),
      ),
    )

    act(() => {
      result.current.initPlayback()
    })

    act(() => {
      result.current.speakCoachText('   ')
    })
    expect(mocks.controller.speak).not.toHaveBeenCalled()

    act(() => {
      result.current.speakCoachText('😀 🎉')
    })
    expect(mocks.controller.speak).not.toHaveBeenCalled()

    stopRequested = true
    act(() => {
      result.current.speakCoachText('hola')
    })
    expect(mocks.controller.speak).not.toHaveBeenCalled()

    stopRequested = false
    act(() => {
      result.current.speakCoachText('hola 😀')
    })
    expect(mocks.controller.speak).toHaveBeenCalledWith('hola')
  })

  it('uses current TTS config for stream and synthesize requests', async () => {
    const firstProps = createProps()
    const { result, rerender } = renderHook(
      (props) => useCoachPlayback(props),
      {
        initialProps: firstProps,
      },
    )

    act(() => {
      result.current.initPlayback()
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>(),
      headers: new Headers({
        'Content-Type': 'audio/ogg',
      }),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const controllerConfig = mocks.getLastControllerConfig()
    const streamResponse = await controllerConfig.stream('hola')
    const streamRequest = fetchSpy.mock.calls.at(0)
    const streamBody = JSON.parse(String(streamRequest?.[1]?.body ?? '{}'))

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.test/tts-stream',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(streamBody).toMatchObject({
      text: 'hola',
      voiceId: 'voice-1',
      modelId: 'model-1',
      languageCode: 'es',
      outputFormat: 'mp3_44100_128',
      optimizeStreamingLatency: 4,
    })
    expect(streamResponse.mimeType).toBe('audio/ogg')

    const secondProps = createProps({
      ttsConfig: {
        voiceId: 'voice-2',
        modelId: 'model-2',
        languageCode: 'fr',
        outputFormat: 'pcm_16000',
        latencyHint: 2,
      },
    })
    rerender(secondProps)

    await controllerConfig.synthesize('bonjour')

    expect(secondProps.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'bonjour',
      voiceId: 'voice-2',
      modelId: 'model-2',
      languageCode: 'fr',
      outputFormat: 'pcm_16000',
      optimizeStreamingLatency: 2,
    })

    fetchSpy.mockRestore()
  })

  it('forwards shared controller errors to the provided error handler', () => {
    const props = createProps()
    const { result } = renderHook(() => useCoachPlayback(props))
    act(() => {
      result.current.initPlayback()
    })

    const controllerConfig = mocks.getLastControllerConfig()
    const err = new Error('tts failed')
    act(() => {
      controllerConfig.onError(err)
    })

    expect(props.onError).toHaveBeenCalledWith(err)
  })

  it('throws when playback queue initialization fails', () => {
    mocks.setAutoCreatePlaybackQueueOnInit(false)

    const { result } = renderHook(() => useCoachPlayback(createProps()))
    expect(() => result.current.initPlayback()).toThrow(
      'Coach playback queue failed to initialize.',
    )
  })

  it('uses injected preprocessor through the TTS port boundary', async () => {
    const preprocessor: TtsTextPreprocessor = (text) =>
      text === 'skip'
        ? { ok: false, reason: 'empty_after_preprocessing' }
        : { ok: true, text: `custom:${text}` }

    const props = createProps({
      ttsTextPreprocessor: preprocessor,
    })
    const { result } = renderHook(() => useCoachPlayback(props))
    act(() => {
      result.current.initPlayback()
    })

    act(() => {
      result.current.speakCoachText('hola')
      result.current.speakCoachText('skip')
    })
    expect(mocks.controller.speak).toHaveBeenCalledTimes(1)
    expect(mocks.controller.speak).toHaveBeenCalledWith('custom:hola')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>(),
      headers: new Headers(),
      text: vi.fn(() => Promise.resolve('')),
    } as unknown as Response)

    const controllerConfig = mocks.getLastControllerConfig()
    await controllerConfig.stream('bonjour')
    await controllerConfig.synthesize('salut')

    const streamRequest = fetchSpy.mock.calls.at(0)
    const streamBody = JSON.parse(String(streamRequest?.[1]?.body ?? '{}'))
    expect(streamBody).toMatchObject({
      text: 'custom:bonjour',
    })
    expect(props.synthesizeSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'custom:salut',
      }),
    )

    fetchSpy.mockRestore()
  })
})
