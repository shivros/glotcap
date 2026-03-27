import { LANGUAGE_CONTRACTS } from '../../shared/language-contract'
import type { LanguageId } from '../../shared/language-contract'

export type SpeakingLanguageOption = {
  id: LanguageId
  label: string
  targetLanguage: string
  sttLanguage: string
  ttsLanguageCode: string
}

export const languageOptions: Array<SpeakingLanguageOption> =
  LANGUAGE_CONTRACTS.map((language) => ({
    id: language.id,
    label: language.label,
    targetLanguage: language.targetLanguage,
    sttLanguage: language.id,
    ttsLanguageCode: language.id,
  }))
