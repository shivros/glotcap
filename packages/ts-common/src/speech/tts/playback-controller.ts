import { createAudioPlaybackQueue } from '../audio/playback'
import { decodeAudioBuffer } from '../audio/decode'
import type { AudioPlaybackQueue } from '../audio/playback'
import type { TtsStreamResult } from './stream-client'

export type SynthesizeFallbackFn = (
  text: string,
) => Promise<{ audioBase64: string; mimeType: string }>

export type StreamFn = (text: string) => Promise<TtsStreamResult>

export type TtsPlaybackControllerConfig = {
  stream: StreamFn
  synthesize?: SynthesizeFallbackFn
  onError?: (err: unknown) => void
  createPlaybackQueue?: () => AudioPlaybackQueue
  onSpeakingStart?: () => void
  onSpeakingEnd?: () => void
}

export type TtsPlaybackController = {
  init: () => void
  speak: (text: string) => void
  halt: () => void
  interrupt: () => void
  reset: () => void
  isPlaying: () => boolean
  isSpeaking: () => boolean
}

const POLL_MS = 200

export const createTtsPlaybackController = (
  config: TtsPlaybackControllerConfig,
): TtsPlaybackController => {
  const createQueue = config.createPlaybackQueue ?? createAudioPlaybackQueue

  let queue: AudioPlaybackQueue | null = null
  let generation = 0
  let serialQueue: Promise<void> = Promise.resolve()

  let speaking = false
  let pendingSpeaks = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let consecutiveIdleTicks = 0

  const clearPoll = (): void => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    consecutiveIdleTicks = 0
  }

  const endSpeaking = (): void => {
    if (!speaking) return
    speaking = false
    clearPoll()
    config.onSpeakingEnd?.()
  }

  const startPoll = (): void => {
    clearPoll()
    pollTimer = setInterval(() => {
      if (pendingSpeaks === 0 && !(queue?.isPlaying() ?? false)) {
        consecutiveIdleTicks += 1
        if (consecutiveIdleTicks >= 2) {
          endSpeaking()
        }
      } else {
        consecutiveIdleTicks = 0
      }
    }, POLL_MS)
  }

  const beginSpeaking = (): void => {
    if (speaking) return
    speaking = true
    config.onSpeakingStart?.()
    startPoll()
  }

  const init = (): void => {
    endSpeaking()
    queue?.stop()
    queue = createQueue()
    generation += 1
    pendingSpeaks = 0
    serialQueue = Promise.resolve()
  }

  const halt = (): void => {
    queue?.stop()
  }

  const interrupt = (): void => {
    generation += 1
    pendingSpeaks = 0
    serialQueue = Promise.resolve()
    queue?.stop()
    endSpeaking()
  }

  const reset = (): void => {
    endSpeaking()
    queue?.stop()
    queue = null
    generation = 0
    pendingSpeaks = 0
    serialQueue = Promise.resolve()
  }

  const isPlaying = (): boolean => {
    return queue?.isPlaying() ?? false
  }

  const speak = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!queue) return

    beginSpeaking()
    pendingSpeaks += 1

    const capturedGeneration = generation

    serialQueue = serialQueue
      .then(async () => {
        if (generation !== capturedGeneration) return
        if (!queue) return

        try {
          const result = await config.stream(trimmed)
          if (generation !== capturedGeneration) {
            result.cancel()
            return
          }
          queue.enqueueStream(result.stream, result.mimeType, result.cancel)
          return
        } catch (streamErr) {
          if (generation !== capturedGeneration) return
          if (!config.synthesize) {
            throw streamErr
          }
          console.error(
            'TTS stream failed, trying synthesize fallback',
            streamErr,
          )
        }

        const speech = await config.synthesize(trimmed)
        if (generation !== capturedGeneration) return
        const audioBuffer = decodeAudioBuffer(speech.audioBase64)
        queue.enqueue(audioBuffer, speech.mimeType)
      })
      .catch((err) => {
        if (generation !== capturedGeneration) return
        config.onError?.(err)
      })
      .finally(() => {
        if (generation !== capturedGeneration) return
        pendingSpeaks = Math.max(0, pendingSpeaks - 1)
      })
  }

  return {
    init,
    speak,
    halt,
    interrupt,
    reset,
    isPlaying,
    isSpeaking: () => speaking,
  }
}
