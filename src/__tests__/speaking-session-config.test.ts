import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getCoachInterruptionHoldMs,
  getCoachResponseGapMs,
  parseCoachInterruptionHoldMs,
  parseCoachResponseGapMs,
} from '@/lib/speaking-session-config'

type SpeakingSessionEnv = {
  VITE_COACH_RESPONSE_GAP_MS?: string
  VITE_COACH_INTERRUPTION_HOLD_MS?: string
}

describe('speaking-session-config', () => {
  let previousEnv: SpeakingSessionEnv

  beforeEach(() => {
    previousEnv = {
      VITE_COACH_RESPONSE_GAP_MS: import.meta.env.VITE_COACH_RESPONSE_GAP_MS,
      VITE_COACH_INTERRUPTION_HOLD_MS: import.meta.env
        .VITE_COACH_INTERRUPTION_HOLD_MS,
    }
  })

  afterEach(() => {
    const env = import.meta.env as SpeakingSessionEnv
    if (previousEnv.VITE_COACH_RESPONSE_GAP_MS === undefined) {
      delete env.VITE_COACH_RESPONSE_GAP_MS
    } else {
      env.VITE_COACH_RESPONSE_GAP_MS = previousEnv.VITE_COACH_RESPONSE_GAP_MS
    }

    if (previousEnv.VITE_COACH_INTERRUPTION_HOLD_MS === undefined) {
      delete env.VITE_COACH_INTERRUPTION_HOLD_MS
    } else {
      env.VITE_COACH_INTERRUPTION_HOLD_MS =
        previousEnv.VITE_COACH_INTERRUPTION_HOLD_MS
    }
  })

  it('parses coach response gap values through shared voice turn parser', () => {
    expect(parseCoachResponseGapMs('1.4s')).toBe(1400)
    expect(parseCoachResponseGapMs('oops')).toBe(1200)
  })

  it('parses coach interruption hold values through shared interruption parser', () => {
    expect(parseCoachInterruptionHoldMs('300ms')).toBe(300)
    expect(parseCoachInterruptionHoldMs('oops')).toBe(250)
  })

  it('resolves coach config values from env at call time', () => {
    const env = import.meta.env as SpeakingSessionEnv
    env.VITE_COACH_RESPONSE_GAP_MS = '1.1s'
    env.VITE_COACH_INTERRUPTION_HOLD_MS = '0.5s'

    expect(getCoachResponseGapMs()).toBe(1100)
    expect(getCoachInterruptionHoldMs()).toBe(500)
  })

  it('falls back to shared defaults when env values are missing', () => {
    const env = import.meta.env as SpeakingSessionEnv
    delete env.VITE_COACH_RESPONSE_GAP_MS
    delete env.VITE_COACH_INTERRUPTION_HOLD_MS

    expect(getCoachResponseGapMs()).toBe(1200)
    expect(getCoachInterruptionHoldMs()).toBe(250)
  })
})
