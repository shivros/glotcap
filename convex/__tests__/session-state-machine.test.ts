import { describe, expect, it } from 'vitest'
import {
  resolveEndSessionState,
  resolveUsageTransition,
} from '../sessionStateMachine'

describe('sessionStateMachine', () => {
  it('keeps limit status and reason when ending a limited session', () => {
    const result = resolveEndSessionState({
      status: 'limit_reached',
      requestedReason: 'manual',
    })

    expect(result).toEqual({
      status: 'limit_reached',
      terminationReason: 'limit_reached',
    })
  })

  it('defaults termination reason to manual for non-limit session end', () => {
    const result = resolveEndSessionState({
      status: 'active',
    })

    expect(result).toEqual({
      status: 'ended',
      terminationReason: 'manual',
    })
  })

  it('marks usage transition as limit reached when limit is crossed', () => {
    const result = resolveUsageTransition({
      usageMs: 120000,
      deltaMs: 5000,
      limitMs: 124000,
      status: 'active',
    })

    expect(result).toEqual({
      nextUsage: 125000,
      nextStatus: 'limit_reached',
      terminationReason: 'limit_reached',
    })
  })
})
