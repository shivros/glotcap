import { describe, expect, it } from 'vitest'

import { computeRecencyScore } from '../scoring'

describe('learningInsights scoring', () => {
  it('returns full count when lastSeenAt is now', () => {
    const now = Date.now()
    const score = computeRecencyScore({
      count: 3,
      lastSeenAt: now,
      now,
      halfLifeDays: 30,
    })
    expect(score).toBeCloseTo(3, 6)
  })

  it('decays over time with half-life', () => {
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const score = computeRecencyScore({
      count: 2,
      lastSeenAt: now - thirtyDaysMs,
      now,
      halfLifeDays: 30,
    })
    expect(score).toBeCloseTo(2 * Math.exp(-1), 6)
  })
})
