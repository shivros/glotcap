import { parseVoiceTurnGapMs } from './turn-boundary-policy'
import { parseTurnInterruptionHoldMs } from './turn-interruption-config'

type VoiceSessionPolicyCandidate = string | null | undefined

export type VoiceSessionPolicy = {
  turnGapMs: number
  interruptionHoldMs: number
}

export type VoiceSessionPolicyCandidateInput = {
  turnGapMs?: VoiceSessionPolicyCandidate
  interruptionHoldMs?: VoiceSessionPolicyCandidate
}

export type VoiceSessionPolicyCandidateSets = {
  turnGapCandidates: ReadonlyArray<VoiceSessionPolicyCandidate>
  interruptionHoldCandidates: ReadonlyArray<VoiceSessionPolicyCandidate>
}

export type VoiceSessionPolicyFallbackCandidates = {
  fallbackTurnGapMs?: VoiceSessionPolicyCandidate
  fallbackInterruptionHoldMs?: VoiceSessionPolicyCandidate
}

const resolveFirstDefinedCandidate = (
  candidates: ReadonlyArray<VoiceSessionPolicyCandidate>,
) => {
  for (const candidate of candidates) {
    if (candidate != null) {
      return candidate
    }
  }
  return undefined
}

export const resolveVoiceSessionPolicy = ({
  turnGapMs,
  interruptionHoldMs,
}: VoiceSessionPolicyCandidateInput): VoiceSessionPolicy => ({
  turnGapMs: parseVoiceTurnGapMs(turnGapMs ?? undefined),
  interruptionHoldMs: parseTurnInterruptionHoldMs(
    interruptionHoldMs ?? undefined,
  ),
})

export const resolveVoiceSessionPolicyFromCandidates = ({
  turnGapCandidates,
  interruptionHoldCandidates,
}: VoiceSessionPolicyCandidateSets): VoiceSessionPolicy =>
  resolveVoiceSessionPolicy({
    turnGapMs: resolveFirstDefinedCandidate(turnGapCandidates),
    interruptionHoldMs: resolveFirstDefinedCandidate(
      interruptionHoldCandidates,
    ),
  })

export const resolveVoiceSessionPolicyFromCandidatesWithFallback = ({
  turnGapCandidates,
  interruptionHoldCandidates,
  fallbackTurnGapMs,
  fallbackInterruptionHoldMs,
}: VoiceSessionPolicyCandidateSets &
  VoiceSessionPolicyFallbackCandidates): VoiceSessionPolicy =>
  resolveVoiceSessionPolicyFromCandidates({
    turnGapCandidates:
      fallbackTurnGapMs == null
        ? turnGapCandidates
        : [...turnGapCandidates, fallbackTurnGapMs],
    interruptionHoldCandidates:
      fallbackInterruptionHoldMs == null
        ? interruptionHoldCandidates
        : [...interruptionHoldCandidates, fallbackInterruptionHoldMs],
  })
