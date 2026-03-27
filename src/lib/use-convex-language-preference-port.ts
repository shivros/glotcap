import { useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { LanguageId } from '../../shared/language-contract'
import type {
  LanguagePreferencePort,
  RemoteLanguagePreference,
} from '@/lib/language-preference-port'

export const useConvexLanguagePreferencePort = (): LanguagePreferencePort => {
  const remotePreference = useQuery(
    api.userPreferences.getMyLanguagePreference,
    {},
  )
  const persistLanguagePreferenceMutation = useMutation(
    api.userPreferences.setMyLanguagePreference,
  )

  const persistLanguagePreference = useCallback(
    async (languageId: LanguageId) => {
      const result = await persistLanguagePreferenceMutation({ languageId })
      return {
        languageId: result.languageId,
        updatedAt: result.updatedAt,
      }
    },
    [persistLanguagePreferenceMutation],
  )

  return {
    remotePreference: remotePreference as RemoteLanguagePreference,
    persistLanguagePreference,
  }
}
