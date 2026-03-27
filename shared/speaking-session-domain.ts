export const PERSISTED_SPEAKING_SESSION_STATUSES = [
  'active',
  'paused',
  'ended',
  'limit_reached',
] as const

export type PersistedSpeakingSessionStatus =
  (typeof PERSISTED_SPEAKING_SESSION_STATUSES)[number]

export const SESSION_TERMINATION_REASONS = [
  'manual',
  'limit_reached',
  'error',
] as const

export type SessionTerminationReason =
  (typeof SESSION_TERMINATION_REASONS)[number]
