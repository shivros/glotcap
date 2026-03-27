import { createDefaultSttTranscriptHandler } from './default-transcript-handler'
import type { SttDisconnectClassifier } from './default-disconnect-classifier'
import type { SttReconnectStrategy } from './default-reconnect-strategy'
import type { SttRecycleStrategy } from './default-recycle-strategy'
import type { RuntimeSttConfig } from './session-bootstrap'
import type { SttContextStore } from './stt-context-store'
import type { SttLifecycleEvent } from './stt-lifecycle-contract'
import type {
  ConnectionStatePort,
  PlaybackPort,
  SttTranscriptHandler,
  TranscriptPort,
} from './stt-transcript-handler'
import type { SttDisconnectReason } from './stt-reconnect-policy'
import type { SttClient, SttClientHandlers, SttCloseInfo } from './types'

export type SttRecoveryState = 'stable' | 'reconnecting' | 'failed'

export type CreateSessionArgs<TSessionId extends string = string> = {
  sessionId: TSessionId
  sampleRate: number
  language?: string
  model?: string
}

export type SttRuntimePort<TSessionId extends string = string> = {
  createSttSession: (
    args: CreateSessionArgs<TSessionId>,
  ) => Promise<RuntimeSttConfig>
  createSttClient: (
    config: RuntimeSttConfig,
    handlers: SttClientHandlers,
  ) => SttClient
  reconnectStrategy: SttReconnectStrategy
  recycleStrategy: SttRecycleStrategy
  disconnectClassifier: SttDisconnectClassifier
}

export type SttLifecyclePort = {
  onError: (err: unknown, details: { sttClose: SttCloseInfo | null }) => void
  onReady: () => void
  onRecoveryStateChange?: (args: {
    state: SttRecoveryState
    reason: SttDisconnectReason | 'manual' | 'ready'
    attempt: number
    delayMs?: number
  }) => void
  onConnectionLifecycleEvent?: (args: SttLifecycleEvent) => void
}

export type SttConnectionCoordinatorDeps<TSessionId extends string = string> = {
  runtime: SttRuntimePort<TSessionId>
  state: ConnectionStatePort<TSessionId>
  playback: PlaybackPort
  transcript: TranscriptPort<TSessionId>
  lifecycle: SttLifecyclePort
  contextStore: SttContextStore
  transcriptHandler?: SttTranscriptHandler<TSessionId>
}

export type SttConnectionCoordinator<TSessionId extends string = string> = {
  startStt: (args: CreateSessionArgs<TSessionId>) => Promise<void>
  stopStt: () => void
  sendAudio: (payload: ArrayBuffer) => void
  isReady: () => boolean
}

const MAX_PENDING_AUDIO_CHUNKS = 256

const buildCloseError = (closeInfo: SttCloseInfo | null) => {
  const reasonSuffix = closeInfo?.reason
    ? ` (${closeInfo.code}: ${closeInfo.reason})`
    : closeInfo
      ? ` (${closeInfo.code})`
      : ''
  return Object.assign(new Error(`STT connection closed${reasonSuffix}`), {
    code: 'STT_CONNECTION',
  })
}

export const createSttConnectionCoordinator = <
  TSessionId extends string = string,
>({
  getDeps,
}: {
  getDeps: () => SttConnectionCoordinatorDeps<TSessionId>
}): SttConnectionCoordinator<TSessionId> => {
  const state = {
    sttClient: null as SttClient | null,
    activeArgs: null as CreateSessionArgs<TSessionId> | null,
    connectToken: 0,
    reconnectAttempt: 0,
    reconnectTimer: null as ReturnType<typeof setTimeout> | null,
    recycleTimer: null as ReturnType<typeof setTimeout> | null,
    connectionSerial: 0,
    activeConnectionSerial: 0,
    pendingAudio: [] as Array<ArrayBuffer>,
    explicitStop: true,
    recoveryState: 'stable' as SttRecoveryState,
  }

  const defaultTranscriptHandler =
    createDefaultSttTranscriptHandler<TSessionId>()

  const emitRecoveryState = (args: {
    state: SttRecoveryState
    reason: SttDisconnectReason | 'manual' | 'ready'
    attempt: number
    delayMs?: number
  }) => {
    const deps = getDeps()
    const didStateChange = state.recoveryState !== args.state
    state.recoveryState = args.state
    if (didStateChange || args.state === 'reconnecting') {
      deps.lifecycle.onRecoveryStateChange?.(args)
    }
  }

  const clearReconnectTimer = () => {
    if (!state.reconnectTimer) {
      return
    }
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }

  const clearRecycleTimer = () => {
    if (!state.recycleTimer) {
      return
    }
    clearTimeout(state.recycleTimer)
    state.recycleTimer = null
  }

  const isConnectionStale = (sessionId: TSessionId, token: number) => {
    const deps = getDeps()
    return (
      state.explicitStop ||
      deps.state.isStopRequested() ||
      state.connectToken !== token ||
      deps.state.getActiveSessionId() !== sessionId
    )
  }

  const flushPendingAudio = () => {
    const client = state.sttClient
    if (!client || !client.isReady()) {
      return
    }
    while (state.pendingAudio.length > 0) {
      const payload = state.pendingAudio.shift()
      if (payload) {
        client.sendAudio(payload)
      }
    }
  }

  const enqueuePendingAudio = (payload: ArrayBuffer) => {
    state.pendingAudio.push(payload)
    if (state.pendingAudio.length > MAX_PENDING_AUDIO_CHUNKS) {
      state.pendingAudio.shift()
    }
  }

  const connect = async (
    args: CreateSessionArgs<TSessionId>,
    token: number,
  ) => {
    clearReconnectTimer()
    const nextConnectionSerial = state.connectionSerial + 1
    state.connectionSerial = nextConnectionSerial
    state.activeConnectionSerial = nextConnectionSerial

    if (state.sttClient) {
      state.sttClient.close()
      state.sttClient = null
    }
    clearRecycleTimer()

    let disconnectHandled = false
    const handleDisconnectOnce = (
      reason: SttDisconnectReason,
      error: unknown,
      closeInfo: SttCloseInfo | null,
    ) => {
      if (disconnectHandled) {
        return
      }

      const deps = getDeps()
      const isCurrentConnection =
        state.activeConnectionSerial === nextConnectionSerial
      const nextAttempt = state.reconnectAttempt + 1
      const decision = deps.runtime.disconnectClassifier.classify({
        attempt: nextAttempt,
        reason,
        error,
        closeInfo,
        explicitStop: state.explicitStop,
        isConnectionStale: isConnectionStale(args.sessionId, token),
        isConnectionCurrent: isCurrentConnection,
        reconnectStrategy: deps.runtime.reconnectStrategy,
      })

      if (decision === 'ignore') {
        return
      }

      disconnectHandled = true
      state.sttClient = null

      const currentContext = deps.contextStore.get()
      const effectiveClose = closeInfo ?? currentContext.close
      deps.contextStore.set({
        ...currentContext,
        close: effectiveClose,
      })

      deps.lifecycle.onConnectionLifecycleEvent?.({
        stage: 'disconnected',
        provider: currentContext.config?.provider,
        closeInfo: effectiveClose,
      })

      if (decision === 'fail') {
        emitRecoveryState({
          state: 'failed',
          reason,
          attempt: nextAttempt,
        })
        deps.lifecycle.onError(error, {
          sttClose: effectiveClose,
        })
        return
      }

      state.reconnectAttempt = nextAttempt
      const delayMs = deps.runtime.reconnectStrategy.getDelayMs(nextAttempt)
      emitRecoveryState({
        state: 'reconnecting',
        reason,
        attempt: nextAttempt,
        delayMs,
      })

      clearReconnectTimer()
      clearRecycleTimer()
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null
        if (isConnectionStale(args.sessionId, token)) {
          return
        }
        void connect(args, token)
      }, delayMs)
    }

    try {
      const deps = getDeps()
      deps.lifecycle.onConnectionLifecycleEvent?.({
        stage: 'connect_start',
        provider: deps.contextStore.get().config?.provider,
      })

      const config = await deps.runtime.createSttSession(args)
      if (isConnectionStale(args.sessionId, token)) {
        return
      }

      deps.contextStore.set({
        config,
        close: null,
      })

      const recycleSchedule = deps.runtime.recycleStrategy.getSchedule({
        config,
        now: Date.now(),
      })
      deps.lifecycle.onConnectionLifecycleEvent?.({
        stage: 'recycle_scheduled',
        provider: config.provider,
        delayMs: recycleSchedule.delayMs,
        ttlMs: recycleSchedule.ttlMs,
      })
      clearRecycleTimer()
      state.recycleTimer = setTimeout(() => {
        state.recycleTimer = null
        if (isConnectionStale(args.sessionId, token)) {
          return
        }
        const ttlMs =
          typeof config.expiresAt === 'number'
            ? config.expiresAt - Date.now()
            : null
        getDeps().lifecycle.onConnectionLifecycleEvent?.({
          stage: 'recycle_triggered',
          provider: config.provider,
          ttlMs,
        })
        void connect(args, token)
      }, recycleSchedule.delayMs)

      state.sttClient = deps.runtime.createSttClient(config, {
        onTranscript: (event) => {
          const nextDeps = getDeps()
          ;(nextDeps.transcriptHandler ?? defaultTranscriptHandler).handle({
            sessionId: args.sessionId,
            event,
            state: nextDeps.state,
            playback: nextDeps.playback,
            transcript: nextDeps.transcript,
          })
        },
        onError: (err) => {
          handleDisconnectOnce('error', err, deps.contextStore.get().close)
        },
        onClose: (info) => {
          const nextDeps = getDeps()
          const currentContext = nextDeps.contextStore.get()
          nextDeps.contextStore.set({
            ...currentContext,
            close: info,
          })
          if (state.explicitStop) {
            return
          }
          handleDisconnectOnce('close', buildCloseError(info), info)
        },
        onStatus: (status) => {
          if (status === 'ready') {
            state.reconnectAttempt = 0
            const nextDeps = getDeps()
            nextDeps.lifecycle.onConnectionLifecycleEvent?.({
              stage: 'connected',
              provider: config.provider,
            })
            emitRecoveryState({
              state: 'stable',
              reason: 'ready',
              attempt: 0,
            })
            nextDeps.lifecycle.onReady()
            flushPendingAudio()
          }
        },
      })
    } catch (err) {
      handleDisconnectOnce('bootstrap', err, getDeps().contextStore.get().close)
    }
  }

  const stopStt = () => {
    const deps = getDeps()
    state.explicitStop = true
    state.activeArgs = null
    state.connectToken += 1
    state.reconnectAttempt = 0
    state.pendingAudio = []
    clearReconnectTimer()
    clearRecycleTimer()
    if (state.sttClient) {
      state.sttClient.close()
      state.sttClient = null
    }
    deps.contextStore.reset()
    emitRecoveryState({
      state: 'stable',
      reason: 'manual',
      attempt: 0,
    })
  }

  const startStt = async (args: CreateSessionArgs<TSessionId>) => {
    state.explicitStop = false
    state.activeArgs = args
    state.reconnectAttempt = 0
    state.pendingAudio = []
    clearReconnectTimer()
    clearRecycleTimer()
    state.connectToken += 1
    const token = state.connectToken
    await connect(args, token)
  }

  const sendAudio = (payload: ArrayBuffer) => {
    if (state.sttClient) {
      state.sttClient.sendAudio(payload)
      return
    }
    if (!state.activeArgs || state.explicitStop) {
      return
    }
    enqueuePendingAudio(payload)
  }

  const isReady = () => Boolean(state.sttClient?.isReady())

  return {
    startStt,
    stopStt,
    sendAudio,
    isReady,
  }
}
