import type { LanguageId } from '../../shared/language-contract'

export type RemoteLanguagePreference =
  | {
      languageId: LanguageId | null
      isAuthenticated: boolean
    }
  | undefined

export type LanguagePreferencePort = {
  remotePreference: RemoteLanguagePreference
  persistLanguagePreference: (languageId: LanguageId) => Promise<{
    languageId: LanguageId
    updatedAt: number
  }>
}
