import { describe, expect, it } from 'vitest'
import { createDefaultUsageRetryPolicy } from '@/lib/usage/usage-retry-policy'

describe('createDefaultUsageRetryPolicy', () => {
  it('retries transient failures within attempt budget', () => {
    const policy = createDefaultUsageRetryPolicy()
    const transient = new Error(
      '[CONVEX A(speaking:ingestAudioChunk)] Connection lost while action was in flight',
    )

    expect(policy.shouldRetry({ attempt: 1, error: transient })).toBe(true)
    expect(policy.shouldRetry({ attempt: 2, error: transient })).toBe(true)
    expect(policy.shouldRetry({ attempt: 3, error: transient })).toBe(false)
  })

  it('does not retry non-transient failures', () => {
    const policy = createDefaultUsageRetryPolicy()
    expect(
      policy.shouldRetry({ attempt: 1, error: new Error('permission denied') }),
    ).toBe(false)
    expect(
      policy.shouldRetry({ attempt: 1, error: { message: 'network' } }),
    ).toBe(false)
    expect(policy.shouldRetry({ attempt: 1, error: 'failed to fetch' })).toBe(
      true,
    )
  })

  it('backs off delay with an upper bound', () => {
    const policy = createDefaultUsageRetryPolicy()
    expect(policy.getDelayMs(1)).toBe(200)
    expect(policy.getDelayMs(2)).toBe(400)
    expect(policy.getDelayMs(3)).toBe(800)
    expect(policy.getDelayMs(6)).toBe(1500)
  })
})
