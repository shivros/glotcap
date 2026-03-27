export type TranslationMode = 'off' | 'on' | 'hover'

export type TranslationRole = 'self' | 'counterpart'

export type TranslationPreferences = Record<TranslationRole, TranslationMode>

export const DEFAULT_TRANSLATION_PREFERENCES: TranslationPreferences = {
  self: 'off',
  counterpart: 'on',
}

const isTranslationMode = (value: unknown): value is TranslationMode =>
  value === 'off' || value === 'on' || value === 'hover'

export const normalizeTranslationPreferences = (
  input?: Partial<TranslationPreferences> | null,
): TranslationPreferences => ({
  self: isTranslationMode(input?.self)
    ? input.self
    : DEFAULT_TRANSLATION_PREFERENCES.self,
  counterpart: isTranslationMode(input?.counterpart)
    ? input.counterpart
    : DEFAULT_TRANSLATION_PREFERENCES.counterpart,
})

export const parseTranslationPreferences = (
  serialized?: string | null,
): TranslationPreferences => {
  if (!serialized) {
    return DEFAULT_TRANSLATION_PREFERENCES
  }
  try {
    const parsed = JSON.parse(serialized) as Partial<TranslationPreferences>
    return normalizeTranslationPreferences(parsed)
  } catch {
    return DEFAULT_TRANSLATION_PREFERENCES
  }
}

export const isTranslationModeEnabled = (mode: TranslationMode) =>
  mode !== 'off'

export const hasEnabledTranslationMode = (
  preferences: TranslationPreferences,
) =>
  isTranslationModeEnabled(preferences.self) ||
  isTranslationModeEnabled(preferences.counterpart)

export const roleForSpeaker = (
  speaker?: string | null,
): TranslationRole | null =>
  speaker === 'user'
    ? 'self'
    : speaker === 'coach' || speaker === 'teacher'
      ? 'counterpart'
      : null

export const modeForSpeaker = (
  preferences: TranslationPreferences,
  speaker?: string | null,
): TranslationMode => {
  const role = roleForSpeaker(speaker)
  return role ? preferences[role] : 'off'
}
