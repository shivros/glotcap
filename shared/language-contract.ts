export const LANGUAGE_CONTRACTS = [
  { id: 'fr', label: 'French', targetLanguage: 'French' },
  { id: 'es', label: 'Spanish', targetLanguage: 'Spanish' },
  { id: 'de', label: 'German', targetLanguage: 'German' },
  { id: 'it', label: 'Italian', targetLanguage: 'Italian' },
  { id: 'pt', label: 'Portuguese', targetLanguage: 'Portuguese' },
  { id: 'ru', label: 'Russian', targetLanguage: 'Russian' },
  { id: 'ja', label: 'Japanese', targetLanguage: 'Japanese' },
  { id: 'ko', label: 'Korean', targetLanguage: 'Korean' },
  { id: 'zh', label: 'Mandarin', targetLanguage: 'Mandarin' },
] as const

export type LanguageId = (typeof LANGUAGE_CONTRACTS)[number]['id']

export const DEFAULT_LANGUAGE_ID: LanguageId = 'fr'

const SUPPORTED_LANGUAGE_ID_SET = new Set<string>(
  LANGUAGE_CONTRACTS.map((language) => language.id),
)

const TARGET_LANGUAGE_TO_ID = Object.fromEntries(
  LANGUAGE_CONTRACTS.map((language) => [
    language.targetLanguage.toLowerCase(),
    language.id,
  ]),
) as Record<string, LanguageId>

export const isLanguageId = (
  value: string | null | undefined,
): value is LanguageId => {
  if (!value) {
    return false
  }
  return SUPPORTED_LANGUAGE_ID_SET.has(value)
}

export const languageIdFromTargetLanguage = (
  value: string | null | undefined,
): LanguageId | null => {
  if (!value) {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return TARGET_LANGUAGE_TO_ID[normalized] ?? null
}
