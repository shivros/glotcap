const DEFAULT_TURN_INTERRUPTION_HOLD_MS = 250
const MAX_TURN_INTERRUPTION_HOLD_MS = 5000
const DURATION_INPUT_PATTERN = /^([\d._]+)\s*(ms|s)?$/

const normalizeTurnInterruptionHoldMs = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return DEFAULT_TURN_INTERRUPTION_HOLD_MS
  }
  return Math.min(Math.round(value), MAX_TURN_INTERRUPTION_HOLD_MS)
}

export const parseTurnInterruptionHoldMs = (value?: string) => {
  if (!value) {
    return DEFAULT_TURN_INTERRUPTION_HOLD_MS
  }

  const normalized = value.trim().toLowerCase()
  const match = normalized.match(DURATION_INPUT_PATTERN)
  if (!match) {
    return DEFAULT_TURN_INTERRUPTION_HOLD_MS
  }

  const numericPart = match[1] ?? ''
  const numeric = Number(numericPart.replace(/[_ ,]/g, ''))
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_TURN_INTERRUPTION_HOLD_MS
  }

  const unit = match[2] ?? 'ms'
  const millis = unit === 's' ? numeric * 1000 : numeric
  return normalizeTurnInterruptionHoldMs(millis)
}

export {
  DEFAULT_TURN_INTERRUPTION_HOLD_MS,
  MAX_TURN_INTERRUPTION_HOLD_MS,
  normalizeTurnInterruptionHoldMs,
}
