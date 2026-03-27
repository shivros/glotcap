export const VOICE_SESSION_OBSERVABILITY_EVENTS = {
  VOICE_START: 'voice_start',
  VOICE_STOP: 'voice_stop',
  STT_START_REQUESTED: 'stt_start_requested',
  STT_START_READY: 'stt_start_ready',
  STT_START_ABORTED: 'stt_start_aborted',
  STT_CONNECTION_LIFECYCLE: 'stt_connection_lifecycle',
  STT_RECOVERY_STATE: 'stt_recovery_state',
  STARTUP_REQUESTED: 'startup_requested',
  STARTUP_READY: 'startup_ready',
  STARTUP_CANCELED: 'startup_canceled',
  TURN_ORCHESTRATOR_STARTED: 'turn_orchestrator_started',
  VOICE_TURN_CANCEL: 'voice_turn_cancel',
  TURN_SCHEDULED: 'turn_scheduled',
  TURN_SCHEDULE_CANCELED: 'turn_schedule_canceled',
  TURN_FLUSHED: 'turn_flushed',
  TRANSCRIPT_FLUSH_SCHEDULED: 'transcript_flush_scheduled',
  TRANSCRIPT_FLUSH_TRIGGERED: 'transcript_flush_triggered',
  TRANSCRIPT_FLUSH_START: 'transcript_flush_start',
  TRANSCRIPT_FLUSH_SENT: 'transcript_flush_sent',
  TRANSCRIPT_FLUSH_FAILED: 'transcript_flush_failed',
  INTERRUPTION_TRIGGERED: 'interruption_triggered',
  INTERRUPTION_SKIPPED: 'interruption_skipped',
  TURN_INTERRUPTION_EXECUTED: 'turn_interruption_executed',
  STALE_CALLBACK_DROP: 'stale_callback_drop',
  STALE_CALLBACK_DROPPED: 'stale_callback_dropped',
  SESSION_SWITCH_INVALIDATED: 'session_switch_invalidated',
  PLAYBACK_CANCELED: 'playback_canceled',
} as const

export type VoiceSessionObservabilityEventName =
  (typeof VOICE_SESSION_OBSERVABILITY_EVENTS)[keyof typeof VOICE_SESSION_OBSERVABILITY_EVENTS]

export type VoiceSessionObserverEvent = {
  name: VoiceSessionObservabilityEventName | (string & {})
  at?: number
  details?: Record<string, unknown>
}

export type VoiceSessionObserver = {
  emit: (event: VoiceSessionObserverEvent) => void
}

type ConsoleVoiceObserverLog = (
  scope: string,
  eventName: string,
  payload: Record<string, unknown>,
) => void

type VoiceObserverDedupeKeyResolver = (
  event: VoiceSessionObserverEvent,
) => string | null

export type ConsoleVoiceSessionObserverConfig = {
  scope: string
  enabled: boolean
  loggableEventNames: ReadonlySet<string> | ReadonlyArray<string>
  getContext?: () => Record<string, unknown>
  dedupeKeyForEvent?: VoiceObserverDedupeKeyResolver
  staleDedupeWindowMs?: number
  staleDedupeTimestamp?: 'now' | 'event'
  now?: () => number
  log?: ConsoleVoiceObserverLog
}

export const isStaleCallbackEventName = (name: string): boolean =>
  name === VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROP ||
  name === VOICE_SESSION_OBSERVABILITY_EVENTS.STALE_CALLBACK_DROPPED

export const buildStaleCallbackDedupeKey = (
  event: Pick<VoiceSessionObserverEvent, 'name' | 'details'>,
): string | null => {
  if (!isStaleCallbackEventName(event.name)) {
    return null
  }
  const reason =
    typeof event.details?.reason === 'string' ? event.details.reason : 'unknown'
  const phase =
    typeof event.details?.phase === 'string' ? event.details.phase : 'unknown'
  return `${event.name}:${reason}:${phase}`
}

const NOOP_VOICE_SESSION_OBSERVER: VoiceSessionObserver = {
  emit: () => {},
}

const resolveEventTimestamp = (
  event: VoiceSessionObserverEvent,
  now: () => number,
): number => (typeof event.at === 'number' ? event.at : now())

const resolveLoggableEvents = (
  loggableEventNames: ReadonlySet<string> | ReadonlyArray<string>,
): ReadonlySet<string> =>
  loggableEventNames instanceof Set
    ? loggableEventNames
    : new Set(loggableEventNames)

const shouldSkipEvent = (
  eventName: string,
  enabled: boolean,
  loggableEventNames: ReadonlySet<string>,
): boolean => !enabled || !loggableEventNames.has(eventName)

const resolveDedupeTimestamp = (
  event: VoiceSessionObserverEvent,
  now: () => number,
  strategy: 'now' | 'event',
): number => (strategy === 'event' ? resolveEventTimestamp(event, now) : now())

const buildObserverPayload = (
  event: VoiceSessionObserverEvent,
  now: () => number,
  getContext?: () => Record<string, unknown>,
): Record<string, unknown> => {
  const at = resolveEventTimestamp(event, now)
  return {
    at: new Date(at).toISOString(),
    ...(getContext?.() ?? {}),
    ...(event.details ?? {}),
  }
}

const createDedupeGate = ({
  dedupeKeyForEvent,
  staleDedupeWindowMs,
  staleDedupeTimestamp,
  now,
}: {
  dedupeKeyForEvent: VoiceObserverDedupeKeyResolver
  staleDedupeWindowMs: number
  staleDedupeTimestamp: 'now' | 'event'
  now: () => number
}): ((event: VoiceSessionObserverEvent) => boolean) => {
  const recentEvents = new Map<string, number>()

  return (event) => {
    const dedupeKey = dedupeKeyForEvent(event)
    if (!dedupeKey) {
      return false
    }

    const dedupeAt = resolveDedupeTimestamp(event, now, staleDedupeTimestamp)
    const previous = recentEvents.get(dedupeKey)
    if (
      typeof previous === 'number' &&
      dedupeAt - previous < staleDedupeWindowMs
    ) {
      return true
    }
    recentEvents.set(dedupeKey, dedupeAt)
    return false
  }
}

export const createConsoleVoiceSessionObserver = ({
  scope,
  enabled,
  loggableEventNames,
  getContext,
  dedupeKeyForEvent = buildStaleCallbackDedupeKey,
  staleDedupeWindowMs = 750,
  staleDedupeTimestamp = 'now',
  now = Date.now,
  log = (nextScope, eventName, payload) => {
    console.debug(nextScope, eventName, payload)
  },
}: ConsoleVoiceSessionObserverConfig): VoiceSessionObserver => {
  const events = resolveLoggableEvents(loggableEventNames)
  const isDuplicate = createDedupeGate({
    dedupeKeyForEvent,
    staleDedupeWindowMs,
    staleDedupeTimestamp,
    now,
  })

  return {
    emit: (event) => {
      if (shouldSkipEvent(event.name, enabled, events)) {
        return
      }

      if (isDuplicate(event)) {
        return
      }

      log(scope, event.name, buildObserverPayload(event, now, getContext))
    },
  }
}

export const createNoopVoiceSessionObserver = (): VoiceSessionObserver =>
  NOOP_VOICE_SESSION_OBSERVER
