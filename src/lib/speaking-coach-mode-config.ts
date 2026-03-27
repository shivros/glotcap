import type {
  SpeakingConversationMode,
  SpeakingSessionStatus,
} from '@/lib/speaking-session-types'

type ModeStatusLabels = {
  requestingMic: string
  active: string
  idle: string
}

export type ConversationModeConfig = {
  id: SpeakingConversationMode
  selectorLabel: string
  badgeLabel: string
  startActionLabel: string
  readyLabel: string
  counterpartTranslationLabel: string
  fallbackTranscriptSpeaker: 'Coach' | 'Teacher'
  fallbackTranscriptText: string
  requiresTeacherSource: boolean
  missingRequiredSourceLabel: string | null
  statusLabels: ModeStatusLabels
}

const CONVERSATION_MODE_CONFIGS: Record<
  SpeakingConversationMode,
  ConversationModeConfig
> = {
  coach: {
    id: 'coach',
    selectorLabel: 'AI coach',
    badgeLabel: 'AI coach',
    startActionLabel: 'Start talking',
    readyLabel: 'Coach ready',
    counterpartTranslationLabel: 'Coach Translation',
    fallbackTranscriptSpeaker: 'Coach',
    fallbackTranscriptText: 'Start speaking to see your live transcript.',
    requiresTeacherSource: false,
    missingRequiredSourceLabel: null,
    statusLabels: {
      requestingMic: 'Requesting mic',
      active: 'Listening',
      idle: 'Coach ready',
    },
  },
  dual_stream: {
    id: 'dual_stream',
    selectorLabel: 'Teacher call capture',
    badgeLabel: 'Teacher capture',
    startActionLabel: 'Start dual stream',
    readyLabel: 'Dual stream ready',
    counterpartTranslationLabel: 'Teacher Translation',
    fallbackTranscriptSpeaker: 'Teacher',
    fallbackTranscriptText:
      'Start a session to capture learner and teacher transcripts.',
    requiresTeacherSource: true,
    missingRequiredSourceLabel:
      'Select a teacher audio source to start dual-stream mode.',
    statusLabels: {
      requestingMic: 'Requesting audio devices',
      active: 'Listening to learner and teacher',
      idle: 'Dual stream ready',
    },
  },
}

export const CONVERSATION_MODE_ITEMS = Object.values(
  CONVERSATION_MODE_CONFIGS,
).map((config) => ({
  value: config.id,
  label: config.selectorLabel,
}))

export const isConversationMode = (
  value: string | null | undefined,
): value is SpeakingConversationMode =>
  value === 'coach' || value === 'dual_stream'

export const parseConversationMode = (
  value: string | null | undefined,
  fallback: SpeakingConversationMode = 'coach',
): SpeakingConversationMode => (isConversationMode(value) ? value : fallback)

export const getConversationModeConfig = (
  mode: SpeakingConversationMode,
): ConversationModeConfig => CONVERSATION_MODE_CONFIGS[mode]

export const getConversationModeStatusLabel = (
  status: SpeakingSessionStatus,
  mode: SpeakingConversationMode = 'coach',
) => {
  const config = getConversationModeConfig(mode)
  switch (status) {
    case 'requesting_mic':
      return config.statusLabels.requestingMic
    case 'starting':
      return 'Starting session'
    case 'active':
      return config.statusLabels.active
    case 'ending':
      return 'Ending session'
    default:
      return config.statusLabels.idle
  }
}
