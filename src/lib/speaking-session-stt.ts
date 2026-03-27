import { useCallback, useRef } from 'react'
import {
  DEFAULT_STT_RECONNECT_POLICY,
  createRefBackedSttContextStore,
  createSttClient as createRuntimeSttClient,
  createSttConnectionCoordinator,
  createSttCoordinatorDeps,
} from 'ts-common/speech/stt'
import type {
  RuntimeSttConfig,
  CreateSessionArgs as SharedCreateSessionArgs,
  SttConnectionCoordinator as SharedSttConnectionCoordinator,
  SttConnectionCoordinatorDeps as SharedSttConnectionCoordinatorDeps,
  SttClient,
  SttClientHandlers,
  SttCloseInfo,
  SttContext,
  SttDisconnectReason,
  SttLifecycleEvent,
  SttReconnectPolicy,
  SttRecoveryState,
} from 'ts-common/speech/stt'
import type { Id } from '../../convex/_generated/dataModel'
import type { SttStrategyFactory } from '@/lib/speaking-session-stt-strategy-factory'
import { createDefaultSttStrategyFactory } from '@/lib/speaking-session-stt-strategy-factory'

export type { SttContext, SttRecoveryState }

type SpeakingSessionId = Id<'speakingSessions'>
type CreateSessionArgs = SharedCreateSessionArgs<SpeakingSessionId>
type SttConnectionCoordinator =
  SharedSttConnectionCoordinator<SpeakingSessionId>
type SttConnectionCoordinatorDeps =
  SharedSttConnectionCoordinatorDeps<SpeakingSessionId>

type SttPipelineParams = {
  createSttSession: (args: CreateSessionArgs) => Promise<RuntimeSttConfig>
  createSttClient?: (
    config: RuntimeSttConfig,
    handlers: SttClientHandlers,
  ) => SttClient
  reconnectPolicy?: SttReconnectPolicy
  random?: () => number
  getActiveSessionId: () => SpeakingSessionId | null
  isStopRequested: () => boolean
  isPlaybackActive: () => boolean
  haltPlayback: () => void
  onSpeechActivity: (args: {
    sessionId: SpeakingSessionId
    text: string
  }) => void
  onTranscript: (args: { sessionId: SpeakingSessionId; text: string }) => void
  onTranscriptComplete: () => void
  onError: (err: unknown, details: { sttClose: SttCloseInfo | null }) => void
  onReady: () => void
  onRecoveryStateChange?: (args: {
    state: SttRecoveryState
    reason: SttDisconnectReason | 'manual' | 'ready'
    attempt: number
    delayMs?: number
  }) => void
  onConnectionLifecycleEvent?: (args: SttLifecycleEvent) => void
  sttContextRef: { current: SttContext }
  strategyFactory?: SttStrategyFactory
}

type SttPipeline = {
  startStt: (args: CreateSessionArgs) => Promise<void>
  stopStt: () => void
  sendAudio: (payload: ArrayBuffer) => void
  isReady: () => boolean
}

export const useSttPipeline = ({
  createSttSession,
  createSttClient = createRuntimeSttClient,
  reconnectPolicy = DEFAULT_STT_RECONNECT_POLICY,
  random,
  getActiveSessionId,
  isStopRequested,
  isPlaybackActive,
  haltPlayback,
  onSpeechActivity,
  onTranscript,
  onTranscriptComplete,
  onError,
  onReady,
  onRecoveryStateChange,
  onConnectionLifecycleEvent,
  sttContextRef,
  strategyFactory = createDefaultSttStrategyFactory,
}: SttPipelineParams): SttPipeline => {
  const depsRef = useRef<SttConnectionCoordinatorDeps | null>(null)
  const coordinatorRef = useRef<SttConnectionCoordinator>(
    createSttConnectionCoordinator<SpeakingSessionId>({
      getDeps: () => depsRef.current as SttConnectionCoordinatorDeps,
    }),
  )
  const runtimeStrategies = strategyFactory({
    reconnectPolicy,
    random,
  })

  depsRef.current = createSttCoordinatorDeps<SpeakingSessionId>({
    createSttSession,
    createSttClient,
    runtimeStrategies,
    getActiveSessionId,
    isStopRequested,
    isPlaybackActive,
    haltPlayback,
    onSpeechActivity,
    onTranscript,
    onTranscriptComplete,
    onError,
    onReady,
    onRecoveryStateChange,
    onConnectionLifecycleEvent,
    contextStore: createRefBackedSttContextStore(sttContextRef),
  })

  const startStt = useCallback((args: CreateSessionArgs) => {
    return coordinatorRef.current.startStt(args)
  }, [])

  const stopStt = useCallback(() => {
    coordinatorRef.current.stopStt()
  }, [])

  const sendAudio = useCallback((payload: ArrayBuffer) => {
    coordinatorRef.current.sendAudio(payload)
  }, [])

  const isReady = useCallback(() => coordinatorRef.current.isReady(), [])

  return {
    startStt,
    stopStt,
    sendAudio,
    isReady,
  }
}
