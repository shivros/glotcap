import { describe, expect, it } from 'vitest'
import type { SttReconnectPolicy } from '@/lib/stt-reconnect-policy'
import {
  computeSttReconnectDelayMs,
  shouldRetrySttDisconnect,
} from '@/lib/stt-reconnect-policy'

const policy: SttReconnectPolicy = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  jitterRatio: 0,
}

describe('stt reconnect policy', () => {
  it('computes exponential backoff delay', () => {
    expect(
      computeSttReconnectDelayMs({
        attempt: 1,
        policy,
      }),
    ).toBe(100)
    expect(
      computeSttReconnectDelayMs({
        attempt: 2,
        policy,
      }),
    ).toBe(200)
    expect(
      computeSttReconnectDelayMs({
        attempt: 3,
        policy,
      }),
    ).toBe(400)
  })

  it('stops retrying once attempts are exhausted', () => {
    expect(
      shouldRetrySttDisconnect({
        attempt: 4,
        policy,
      }),
    ).toBe(false)
  })

  it('marks non-retryable configuration errors', () => {
    const err = Object.assign(new Error('missing configuration'), {
      code: 'STT_CONFIG_MISSING',
    })
    expect(
      shouldRetrySttDisconnect({
        attempt: 1,
        policy,
        error: err,
      }),
    ).toBe(false)
  })
})
