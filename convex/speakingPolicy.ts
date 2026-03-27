import {
  DEFAULT_AUTH_DAILY_LIMIT_MS,
  parseLimitMs,
  resolveDemoLimitMs,
} from 'ts-common/speech/limits'

const MOVE_FAST_DEFAULT_DEMO_LIMIT_MS = 0
const AUTH_DAILY_LIMIT_OVERRIDE_MS = parseLimitMs(
  process.env.AUTH_DAILY_LIMIT_MS,
)
const DEMO_LIMIT_OVERRIDE_MS = parseLimitMs(process.env.DEMO_LIMIT_MS)

export const AUTH_DAILY_LIMIT_MS =
  AUTH_DAILY_LIMIT_OVERRIDE_MS ?? DEFAULT_AUTH_DAILY_LIMIT_MS

export type DemoLimitSource = 'override' | 'unlimited_default'

export const resolveDemoSessionLimitMs = (explicitLimitMs?: number) =>
  resolveDemoLimitMs({
    explicitLimitMs:
      DEMO_LIMIT_OVERRIDE_MS === undefined ? explicitLimitMs : undefined,
    disableLimit: false,
    defaultLimitMs: DEMO_LIMIT_OVERRIDE_MS ?? MOVE_FAST_DEFAULT_DEMO_LIMIT_MS,
  })

export const resolveDemoLimitSource = (): DemoLimitSource =>
  DEMO_LIMIT_OVERRIDE_MS !== undefined ? 'override' : 'unlimited_default'
