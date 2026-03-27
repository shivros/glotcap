import { DEFAULT_STT_RECONNECT_POLICY } from './stt-reconnect-policy'
import { createDefaultSttDisconnectClassifier } from './default-disconnect-classifier'
import { createDefaultSttReconnectStrategy } from './default-reconnect-strategy'
import { createDefaultSttRecycleStrategy } from './default-recycle-strategy'
import type { SttReconnectPolicy } from './stt-reconnect-policy'
import type { SttDisconnectClassifier } from './default-disconnect-classifier'
import type { SttReconnectStrategy } from './default-reconnect-strategy'
import type { SttRecycleStrategy } from './default-recycle-strategy'

export type SttRuntimeStrategies = {
  reconnectStrategy: SttReconnectStrategy
  recycleStrategy: SttRecycleStrategy
  disconnectClassifier: SttDisconnectClassifier
}

export const createDefaultSttRuntimeStrategies = (args?: {
  reconnectPolicy?: SttReconnectPolicy
  random?: () => number
}): SttRuntimeStrategies => ({
  reconnectStrategy: createDefaultSttReconnectStrategy({
    policy: args?.reconnectPolicy ?? DEFAULT_STT_RECONNECT_POLICY,
    random: args?.random,
  }),
  recycleStrategy: createDefaultSttRecycleStrategy(),
  disconnectClassifier: createDefaultSttDisconnectClassifier(),
})
