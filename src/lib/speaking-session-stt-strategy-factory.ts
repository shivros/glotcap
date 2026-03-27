import { createDefaultSttRuntimeStrategies } from 'ts-common/speech/stt'
import type {
  SttReconnectPolicy,
  SttRuntimeStrategies,
} from 'ts-common/speech/stt'

type SttStrategyFactoryArgs = {
  reconnectPolicy: SttReconnectPolicy
  random?: () => number
}

export type SttStrategyFactory = (
  args: SttStrategyFactoryArgs,
) => SttRuntimeStrategies

export const createDefaultSttStrategyFactory: SttStrategyFactory = ({
  reconnectPolicy,
  random,
}) =>
  createDefaultSttRuntimeStrategies({
    reconnectPolicy,
    random,
  })
