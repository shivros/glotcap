import {
  computeSttReconnectDelayMs,
  shouldRetrySttDisconnect,
} from './stt-reconnect-policy'
import type { SttReconnectPolicy } from './stt-reconnect-policy'

export interface SttReconnectStrategy {
  shouldRetry: (args: { attempt: number; error?: unknown }) => boolean
  getDelayMs: (attempt: number) => number
}

export const createDefaultSttReconnectStrategy = ({
  policy,
  random,
}: {
  policy: SttReconnectPolicy
  random?: () => number
}): SttReconnectStrategy => ({
  shouldRetry: ({ attempt, error }) =>
    shouldRetrySttDisconnect({
      attempt,
      policy,
      error,
    }),
  getDelayMs: (attempt) =>
    computeSttReconnectDelayMs({
      attempt,
      policy,
      random,
    }),
})
