import { v } from 'convex/values'
import type {
  PersistedSpeakingSessionStatus,
  SessionTerminationReason,
} from '../shared/speaking-session-domain'

export type { PersistedSpeakingSessionStatus, SessionTerminationReason }

export const persistedSpeakingSessionStatusValidator = v.union(
  v.literal('active'),
  v.literal('paused'),
  v.literal('ended'),
  v.literal('limit_reached'),
)

export const sessionTerminationReasonValidator = v.union(
  v.literal('manual'),
  v.literal('limit_reached'),
  v.literal('error'),
)
