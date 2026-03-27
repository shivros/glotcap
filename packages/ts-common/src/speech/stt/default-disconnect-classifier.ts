import type { SttCloseInfo } from './types'
import type { SttDisconnectReason } from './stt-reconnect-policy'
import type { SttReconnectStrategy } from './default-reconnect-strategy'

export type SttDisconnectDecision = 'ignore' | 'retry' | 'fail'

export interface SttDisconnectClassifier {
  classify: (args: {
    attempt: number
    reason: SttDisconnectReason
    error: unknown
    closeInfo: SttCloseInfo | null
    explicitStop: boolean
    isConnectionStale: boolean
    isConnectionCurrent: boolean
    reconnectStrategy: SttReconnectStrategy
  }) => SttDisconnectDecision
}

export const createDefaultSttDisconnectClassifier =
  (): SttDisconnectClassifier => ({
    classify: ({
      attempt,
      error,
      explicitStop,
      isConnectionStale,
      isConnectionCurrent,
      reconnectStrategy,
    }) => {
      if (explicitStop || isConnectionStale || !isConnectionCurrent) {
        return 'ignore'
      }

      if (reconnectStrategy.shouldRetry({ attempt, error })) {
        return 'retry'
      }

      return 'fail'
    },
  })
