import { useCallback, useRef } from 'react'
import { createAudioPlaybackQueue } from 'ts-common/speech/audio'
import {
  createManagedTtsPlayback,
  createTtsPlaybackController,
} from 'ts-common/speech/tts'
import type { TtsTextPreprocessor } from '../../shared/tts-text-preprocessor'
import type { MutableRefObject } from 'react'
import type { AudioPlaybackQueue } from 'ts-common/speech/audio'
import type {
  CoachTtsPort,
  CoachTtsPortConfig,
  SynthesizeSpeech,
  TtsConfig,
} from '@/lib/speaking-session-coach-tts-port'
import { createCoachTtsPort } from '@/lib/speaking-session-coach-tts-port'

type CoachPlaybackParams = {
  ttsStreamUrl: URL | null
  ttsConfig: TtsConfig
  synthesizeSpeech: SynthesizeSpeech
  ttsTextPreprocessor?: TtsTextPreprocessor
  isStopRequested: () => boolean
  onError: (err: unknown) => void
}

type CoachPlaybackHandle = {
  playbackRef: MutableRefObject<AudioPlaybackQueue | null>
  initPlayback: () => AudioPlaybackQueue
  haltPlayback: () => void
  interruptPlayback: () => void
  resetPlayback: () => void
  isPlaying: () => boolean
  speakCoachText: (text: string) => void
}

export const useCoachPlayback = ({
  ttsStreamUrl,
  ttsConfig,
  synthesizeSpeech,
  ttsTextPreprocessor,
  isStopRequested,
  onError,
}: CoachPlaybackParams): CoachPlaybackHandle => {
  const playbackRef = useRef<AudioPlaybackQueue | null>(null)
  const configRef = useRef<CoachTtsPortConfig>({
    ttsStreamUrl,
    ttsConfig,
    synthesizeSpeech,
    preprocessor: ttsTextPreprocessor,
  })
  const ttsPortRef = useRef<CoachTtsPort | null>(null)
  const managedPlaybackRef = useRef<ReturnType<
    typeof createManagedTtsPlayback
  > | null>(null)
  const errorHandlerRef = useRef(onError)
  const stopRequestedRef = useRef(isStopRequested)

  configRef.current = {
    ttsStreamUrl,
    ttsConfig,
    synthesizeSpeech,
    preprocessor: ttsTextPreprocessor,
  }
  errorHandlerRef.current = onError
  stopRequestedRef.current = isStopRequested

  const ensureTtsPort = useCallback(() => {
    if (!ttsPortRef.current) {
      ttsPortRef.current = createCoachTtsPort({
        getConfig: () => configRef.current,
      })
    }
    return ttsPortRef.current
  }, [])

  const ensureController = useCallback(() => {
    if (managedPlaybackRef.current) {
      return managedPlaybackRef.current
    }

    managedPlaybackRef.current = createManagedTtsPlayback({
      createController: (callbacks) =>
        createTtsPlaybackController({
          stream: (text) => ensureTtsPort().stream(text),
          synthesize: (text) => ensureTtsPort().synthesize(text),
          onError: callbacks.onError,
          onSpeakingStart: callbacks.onSpeakingStart,
          onSpeakingEnd: callbacks.onSpeakingEnd,
          createPlaybackQueue: () => {
            const playback = createAudioPlaybackQueue()
            playbackRef.current = playback
            return playback
          },
        }),
      onError: (err) => {
        console.error('Coach reply failed', err)
        errorHandlerRef.current(err)
      },
    })
    return managedPlaybackRef.current
  }, [ensureTtsPort])

  const initPlayback = useCallback(() => {
    const controller = ensureController().ensureController()
    controller.init()
    if (!playbackRef.current) {
      throw new Error('Coach playback queue failed to initialize.')
    }
    return playbackRef.current
  }, [ensureController])

  const haltPlayback = useCallback(() => {
    managedPlaybackRef.current?.halt()
  }, [])

  const interruptPlayback = useCallback(() => {
    managedPlaybackRef.current?.interrupt()
  }, [])

  const resetPlayback = useCallback(() => {
    managedPlaybackRef.current?.stop()
    playbackRef.current = null
  }, [])

  const speakCoachText = useCallback(
    (text: string) => {
      const preparedText = ensureTtsPort().prepareText(text)
      if (!preparedText || stopRequestedRef.current()) {
        return
      }

      ensureController().getController()?.speak(preparedText)
    },
    [ensureController, ensureTtsPort],
  )

  return {
    playbackRef,
    initPlayback,
    haltPlayback,
    interruptPlayback,
    resetPlayback,
    isPlaying: () => managedPlaybackRef.current?.isPlaying() ?? false,
    speakCoachText,
  }
}
