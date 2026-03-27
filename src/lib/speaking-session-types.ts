export type SpeakingSessionStatus =
  | 'idle'
  | 'requesting_mic'
  | 'starting'
  | 'active'
  | 'ending'
  | 'limit_reached'
  | 'error'

export type SpeakingSessionMode = 'demo' | 'standard'
export type SpeakingConversationMode = 'coach' | 'dual_stream'
export type TeacherInputSourceMethod = 'device' | 'display'

export const isTeacherInputSourceMethod = (
  value: string | null | undefined,
): value is TeacherInputSourceMethod =>
  value === 'device' || value === 'display'

export const parseTeacherInputSourceMethod = (
  value: string | null | undefined,
  fallback: TeacherInputSourceMethod = 'device',
): TeacherInputSourceMethod =>
  isTeacherInputSourceMethod(value) ? value : fallback

export type MicPermission = 'unknown' | 'granted' | 'denied' | 'unsupported'
export type AudioSupportStatus = 'unknown' | 'supported' | 'unsupported'

export type SpeakingSessionOptions = {
  mode?: SpeakingSessionMode
  conversationMode?: SpeakingConversationMode
  demoId?: string
  targetLanguage: string
  sourceLanguage?: string
  limitMs?: number
  learnerInputDeviceId?: string
  teacherInputDeviceId?: string
  teacherInputSourceMethod?: TeacherInputSourceMethod
  sttLanguage?: string
  sttModel?: string
  ttsVoiceId?: string
  ttsModelId?: string
  ttsLanguageCode?: string
  ttsOutputFormat?: string
  ttsLatencyHint?: number
}
