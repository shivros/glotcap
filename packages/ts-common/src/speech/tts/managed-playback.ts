import type { TtsPlaybackController } from './playback-controller'

type ManagedTtsPlaybackCallbacks = {
  onError: (err: unknown) => void
  onSpeakingStart: () => void
  onSpeakingEnd: () => void
}

type ManagedTtsPlaybackStaleDrop = {
  phase: 'tts_controller_error' | 'tts_playback_start' | 'tts_playback_end'
  reason: 'controller_stale'
}

type ManagedTtsPlaybackCanceledArgs = {
  reason: 'stop' | 'interrupt'
}

type ManagedTtsPlaybackConfig = {
  createController: (
    callbacks: ManagedTtsPlaybackCallbacks,
  ) => TtsPlaybackController
  onError?: (err: unknown) => void
  onPlaybackStart?: () => void
  onPlaybackEnd?: () => void
  onStaleCallbackDrop?: (args: ManagedTtsPlaybackStaleDrop) => void
  onPlaybackCanceled?: (args: ManagedTtsPlaybackCanceledArgs) => void
}

export type ManagedTtsPlayback = {
  ensureController: () => TtsPlaybackController
  getController: () => TtsPlaybackController | null
  stop: () => void
  interrupt: () => void
  halt: () => void
  isPlaying: () => boolean
  dispose: () => void
}

export const createManagedTtsPlayback = (
  config: ManagedTtsPlaybackConfig,
): ManagedTtsPlayback => {
  let controller: TtsPlaybackController | null = null
  let generation = 0

  const ensureController = () => {
    if (controller) {
      return controller
    }

    const nextGeneration = generation + 1
    generation = nextGeneration
    let nextController: TtsPlaybackController | null = null

    const isCurrentController = () =>
      controller === nextController && generation === nextGeneration
    const dropIfStale = (
      phase: 'tts_controller_error' | 'tts_playback_start' | 'tts_playback_end',
    ) => {
      if (isCurrentController()) {
        return false
      }
      config.onStaleCallbackDrop?.({
        phase,
        reason: 'controller_stale',
      })
      return true
    }

    nextController = config.createController({
      onError: (err) => {
        if (dropIfStale('tts_controller_error')) {
          return
        }
        config.onError?.(err)
      },
      onSpeakingStart: () => {
        if (dropIfStale('tts_playback_start')) {
          return
        }
        config.onPlaybackStart?.()
      },
      onSpeakingEnd: () => {
        if (dropIfStale('tts_playback_end')) {
          return
        }
        config.onPlaybackEnd?.()
      },
    })

    controller = nextController
    return nextController
  }

  const stop = () => {
    const activeController = controller
    if (!activeController) {
      return
    }
    const wasPlaying = activeController.isSpeaking()
    generation += 1
    controller = null
    activeController.reset()
    if (wasPlaying) {
      config.onPlaybackCanceled?.({ reason: 'stop' })
    }
  }

  const interrupt = () => {
    const activeController = controller
    if (!activeController) {
      return
    }
    const wasPlaying = activeController.isSpeaking()
    activeController.interrupt()
    if (wasPlaying) {
      config.onPlaybackCanceled?.({ reason: 'interrupt' })
    }
  }

  return {
    ensureController,
    getController: () => controller,
    stop,
    interrupt,
    halt: () => {
      controller?.halt()
    },
    isPlaying: () => controller?.isSpeaking() ?? false,
    dispose: () => {
      const activeController = controller
      if (!activeController) {
        return
      }
      generation += 1
      controller = null
      activeController.reset()
    },
  }
}

export type {
  ManagedTtsPlaybackCallbacks,
  ManagedTtsPlaybackCanceledArgs,
  ManagedTtsPlaybackConfig,
  ManagedTtsPlaybackStaleDrop,
}
