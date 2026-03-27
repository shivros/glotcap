export const DEFAULT_DEMO_LIMIT_MS = 5 * 60 * 1000
export const DEFAULT_AUTH_DAILY_LIMIT_MS = 60 * 60 * 1000

const normalizeLimit = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return Math.max(0, Math.round(value))
}

export const parseLimitMs = (value?: string) => {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  const match = normalized.match(/^([\d._]+)\s*(ms|s|m|h)?$/)
  const rawNumeric = match?.[1]
  if (!rawNumeric) {
    return undefined
  }
  const numeric = Number(rawNumeric.replace(/[_ ,]/g, ''))
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined
  }
  const unit = match[2] ?? 'ms'
  const multiplier =
    unit === 'h' ? 3600000 : unit === 'm' ? 60000 : unit === 's' ? 1000 : 1
  return Math.round(numeric * multiplier)
}

export const shouldDisableDemoLimit = (args: {
  isDev?: boolean
  deployment?: string
  nodeEnv?: string
}) => {
  return Boolean(args.isDev)
}

export const resolveDemoLimitMs = (args: {
  explicitLimitMs?: number
  disableLimit?: boolean
  defaultLimitMs?: number
}) => {
  const normalized = normalizeLimit(args.explicitLimitMs)
  if (normalized !== undefined) {
    return normalized
  }
  if (args.disableLimit) {
    return 0
  }
  return normalizeLimit(args.defaultLimitMs ?? DEFAULT_DEMO_LIMIT_MS) ?? 0
}
