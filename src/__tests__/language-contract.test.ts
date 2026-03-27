import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE_ID,
  LANGUAGE_CONTRACTS,
  isLanguageId,
  languageIdFromTargetLanguage,
} from '../../shared/language-contract'

describe('language-contract', () => {
  it('defines a stable default language id', () => {
    expect(DEFAULT_LANGUAGE_ID).toBe('fr')
    expect(isLanguageId(DEFAULT_LANGUAGE_ID)).toBe(true)
  })

  it('accepts all configured language ids and rejects unknown ids', () => {
    for (const language of LANGUAGE_CONTRACTS) {
      expect(isLanguageId(language.id)).toBe(true)
    }
    expect(isLanguageId('xx')).toBe(false)
  })

  it('maps target language names to language ids', () => {
    expect(languageIdFromTargetLanguage('Russian')).toBe('ru')
    expect(languageIdFromTargetLanguage(' mandarin ')).toBe('zh')
    expect(languageIdFromTargetLanguage('Unknown')).toBeNull()
  })
})
