import { describe, expect, it } from 'vitest'
import {
  PERSISTED_SPEAKING_SESSION_STATUSES,
  SESSION_TERMINATION_REASONS,
} from '../../shared/speaking-session-domain'

describe('speaking session domain contract', () => {
  it('defines persisted statuses expected by session state handlers', () => {
    expect(PERSISTED_SPEAKING_SESSION_STATUSES).toEqual([
      'active',
      'paused',
      'ended',
      'limit_reached',
    ])
  })

  it('defines termination reasons expected by lifecycle + backend', () => {
    expect(SESSION_TERMINATION_REASONS).toEqual([
      'manual',
      'limit_reached',
      'error',
    ])
  })
})
