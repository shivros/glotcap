import type { SttCloseInfo } from './types'

export type SttLifecycleStage =
  | 'connect_start'
  | 'connected'
  | 'disconnected'
  | 'recycle_scheduled'
  | 'recycle_triggered'

export type SttLifecycleEvent = {
  stage: SttLifecycleStage
  provider?: string
  closeInfo?: SttCloseInfo | null
  delayMs?: number
  ttlMs?: number | null
}
