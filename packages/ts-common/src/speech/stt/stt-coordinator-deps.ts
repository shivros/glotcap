import type { SttRuntimeStrategies } from './default-runtime-strategies'
import type {
  SttConnectionCoordinatorDeps,
  SttRecoveryState,
} from './stt-connection-coordinator'
import type { SttContextStore } from './stt-context-store'
import type { SttLifecycleEvent } from './stt-lifecycle-contract'
import type { SttDisconnectReason } from './stt-reconnect-policy'
import type { SttTranscriptHandler } from './stt-transcript-handler'
import type { RuntimeSttConfig } from './session-bootstrap'
import type { SttClient, SttClientHandlers, SttCloseInfo } from './types'

type CreateSttCoordinatorDepsArgs<TSessionId extends string = string> = {
  createSttSession: (args: {
    sessionId: TSessionId
    sampleRate: number
    language?: string
    model?: string
  }) => Promise<RuntimeSttConfig>
  createSttClient: (
    config: RuntimeSttConfig,
    handlers: SttClientHandlers,
  ) => SttClient
  runtimeStrategies: SttRuntimeStrategies
  getActiveSessionId: () => TSessionId | null
  isStopRequested: () => boolean
  isPlaybackActive: () => boolean
  haltPlayback: () => void
  onSpeechActivity: (args: { sessionId: TSessionId; text: string }) => void
  onTranscript: (args: { sessionId: TSessionId; text: string }) => void
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
  contextStore: SttContextStore
  transcriptHandler?: SttTranscriptHandler<TSessionId>
}

export const createSttCoordinatorDeps = <TSessionId extends string = string>(
  args: CreateSttCoordinatorDepsArgs<TSessionId>,
): SttConnectionCoordinatorDeps<TSessionId> => ({
  runtime: {
    createSttSession: args.createSttSession,
    createSttClient: args.createSttClient,
    reconnectStrategy: args.runtimeStrategies.reconnectStrategy,
    recycleStrategy: args.runtimeStrategies.recycleStrategy,
    disconnectClassifier: args.runtimeStrategies.disconnectClassifier,
  },
  state: {
    getActiveSessionId: args.getActiveSessionId,
    isStopRequested: args.isStopRequested,
  },
  playback: {
    isPlaybackActive: args.isPlaybackActive,
    haltPlayback: args.haltPlayback,
  },
  transcript: {
    onSpeechActivity: args.onSpeechActivity,
    onTranscript: args.onTranscript,
    onTranscriptComplete: args.onTranscriptComplete,
  },
  lifecycle: {
    onError: args.onError,
    onReady: args.onReady,
    onRecoveryStateChange: args.onRecoveryStateChange,
    onConnectionLifecycleEvent: args.onConnectionLifecycleEvent,
  },
  contextStore: args.contextStore,
  transcriptHandler: args.transcriptHandler,
})

export type { CreateSttCoordinatorDepsArgs }
