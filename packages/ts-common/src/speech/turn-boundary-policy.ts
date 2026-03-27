const DEFAULT_VOICE_TURN_GAP_MS = 1200
const MAX_VOICE_TURN_GAP_MS = 10000

export type VoiceTurnBoundaryPolicy = {
  responseGapMs: number
}

export type VoiceTurnBoundaryPolicyInput =
  | number
  | string
  | null
  | undefined
  | Partial<VoiceTurnBoundaryPolicy>

const DURATION_INPUT_PATTERN = /^([\d._]+)\s*(ms|s)?$/

const parseDurationText = (value?: string) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  const match = normalized.match(DURATION_INPUT_PATTERN)
  if (!match) {
    return undefined
  }

  const numericPart = match[1]
  if (!numericPart) {
    return undefined
  }

  const numeric = Number(numericPart.replace(/[_ ,]/g, ''))
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined
  }

  const unit = match[2] ?? 'ms'
  const millis = unit === 's' ? numeric * 1000 : numeric
  return Math.round(millis)
}

const normalizeGapMs = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return DEFAULT_VOICE_TURN_GAP_MS
  }
  return Math.min(Math.round(value), MAX_VOICE_TURN_GAP_MS)
}

export const parseVoiceTurnGapMs = (value?: string) =>
  normalizeGapMs(parseDurationText(value))

export const resolveVoiceTurnBoundaryPolicy = (
  value?: VoiceTurnBoundaryPolicyInput,
): VoiceTurnBoundaryPolicy => {
  if (typeof value === 'string') {
    return {
      responseGapMs: parseVoiceTurnGapMs(value),
    }
  }

  if (typeof value === 'number' || value == null) {
    return {
      responseGapMs: normalizeGapMs(value),
    }
  }

  return {
    responseGapMs: normalizeGapMs(value.responseGapMs),
  }
}

export const resolveVoiceTurnGapMs = (value?: VoiceTurnBoundaryPolicyInput) =>
  resolveVoiceTurnBoundaryPolicy(value).responseGapMs

export { DEFAULT_VOICE_TURN_GAP_MS, MAX_VOICE_TURN_GAP_MS }
