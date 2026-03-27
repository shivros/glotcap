import type { RuntimeSttConfig } from './session-bootstrap'

const DEFAULT_STT_RECYCLE_MS = 4 * 60 * 1000
const MIN_RECYCLE_DELAY_MS = 1000
const RECYCLE_LEEWAY_MS = 10000

export interface SttRecycleSchedule {
  delayMs: number
  ttlMs: number | null
}

export interface SttRecycleStrategy {
  getSchedule: (args: {
    config: RuntimeSttConfig
    now: number
  }) => SttRecycleSchedule
}

export const createDefaultSttRecycleStrategy = (): SttRecycleStrategy => ({
  getSchedule: ({ config, now }) => {
    const expiresAt = config.expiresAt ?? null
    const ttlMs =
      typeof expiresAt === 'number' && Number.isFinite(expiresAt)
        ? Math.max(expiresAt - now, 0)
        : null
    const delayMs =
      ttlMs !== null
        ? Math.max(ttlMs - RECYCLE_LEEWAY_MS, MIN_RECYCLE_DELAY_MS)
        : DEFAULT_STT_RECYCLE_MS

    return {
      delayMs,
      ttlMs,
    }
  },
})
