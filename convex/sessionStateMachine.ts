import type {
  PersistedSpeakingSessionStatus,
  SessionTerminationReason,
} from './speakingDomain'

type ResolveEndSessionStateArgs = {
  status: PersistedSpeakingSessionStatus
  requestedReason?: SessionTerminationReason
}

type ResolveUsageTransitionArgs = {
  usageMs: number
  deltaMs: number
  limitMs: number
  status: PersistedSpeakingSessionStatus
}

export const resolveEndSessionState = ({
  status,
  requestedReason,
}: ResolveEndSessionStateArgs): {
  status: PersistedSpeakingSessionStatus
  terminationReason: SessionTerminationReason
} => {
  if (status === 'limit_reached') {
    return {
      status: 'limit_reached',
      terminationReason: 'limit_reached',
    }
  }

  return {
    status: 'ended',
    terminationReason: requestedReason ?? 'manual',
  }
}

export const resolveUsageTransition = ({
  usageMs,
  deltaMs,
  limitMs,
  status,
}: ResolveUsageTransitionArgs) => {
  const nextUsage = usageMs + deltaMs
  const limitReached = limitMs > 0 && nextUsage >= limitMs
  const nextStatus: PersistedSpeakingSessionStatus = limitReached
    ? 'limit_reached'
    : status
  const terminationReason: SessionTerminationReason | null = limitReached
    ? 'limit_reached'
    : null

  return {
    nextUsage,
    nextStatus,
    terminationReason,
  }
}
