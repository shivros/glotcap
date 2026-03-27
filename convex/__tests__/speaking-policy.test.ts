import { afterEach, describe, expect, it, vi } from 'vitest'

const loadPolicyModule = async () => {
  vi.resetModules()
  return import('../speakingPolicy')
}

describe('speakingPolicy', () => {
  afterEach(() => {
    delete process.env.DEMO_LIMIT_MS
    delete process.env.AUTH_DAILY_LIMIT_MS
    vi.resetModules()
  })

  it('defaults demo sessions to unlimited in move-fast mode', async () => {
    const policy = await loadPolicyModule()

    expect(policy.resolveDemoSessionLimitMs()).toBe(0)
    expect(policy.resolveDemoSessionLimitMs(120000)).toBe(120000)
    expect(policy.resolveDemoLimitSource()).toBe('unlimited_default')
  })

  it('respects DEMO_LIMIT_MS override when configured', async () => {
    process.env.DEMO_LIMIT_MS = '10m'
    const policy = await loadPolicyModule()

    expect(policy.resolveDemoSessionLimitMs()).toBe(600000)
    expect(policy.resolveDemoSessionLimitMs(120000)).toBe(600000)
    expect(policy.resolveDemoLimitSource()).toBe('override')
  })

  it('respects AUTH_DAILY_LIMIT_MS override when configured', async () => {
    process.env.AUTH_DAILY_LIMIT_MS = '90m'
    const policy = await loadPolicyModule()

    expect(policy.AUTH_DAILY_LIMIT_MS).toBe(5400000)
  })
})
