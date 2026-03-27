import { parseVoiceTurnGapMs } from 'ts-common/speech/turn-boundary-policy'
import { parseTurnInterruptionHoldMs } from 'ts-common/speech/turn-interruption-config'
import { resolveVoiceSessionPolicyFromCandidates } from 'ts-common/speech/voice-session-policy-resolver'

export const parseCoachResponseGapMs = parseVoiceTurnGapMs
export const parseCoachInterruptionHoldMs = parseTurnInterruptionHoldMs

type CoachSessionEnv = {
  VITE_COACH_RESPONSE_GAP_MS?: string
  VITE_COACH_INTERRUPTION_HOLD_MS?: string
}

const resolveCoachVoiceSessionPolicy = (
  env: CoachSessionEnv = import.meta.env as CoachSessionEnv,
) =>
  resolveVoiceSessionPolicyFromCandidates({
    turnGapCandidates: [env.VITE_COACH_RESPONSE_GAP_MS],
    interruptionHoldCandidates: [env.VITE_COACH_INTERRUPTION_HOLD_MS],
  })

export const getCoachResponseGapMs = () =>
  resolveCoachVoiceSessionPolicy().turnGapMs

export const getCoachInterruptionHoldMs = () =>
  resolveCoachVoiceSessionPolicy().interruptionHoldMs
