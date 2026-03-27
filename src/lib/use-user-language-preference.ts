import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_LANGUAGE_ID,
  isLanguageId,
} from '../../shared/language-contract'
import type { LanguageId } from '../../shared/language-contract'
import type { LanguagePreferencePort } from '@/lib/language-preference-port'
import type { KeyValueStore } from '@/lib/key-value-store'
import { createBrowserKeyValueStore } from '@/lib/key-value-store'
import { useConvexLanguagePreferencePort } from '@/lib/use-convex-language-preference-port'

export const LANGUAGE_PREFERENCE_STORAGE_KEY = 'glotcap-app-language'

type UseUserLanguagePreferenceArgs = {
  store?: KeyValueStore | null
  defaultLanguageId?: string
}

type UseUserLanguagePreferenceWithPortArgs = UseUserLanguagePreferenceArgs & {
  port: LanguagePreferencePort
}

const getStore = (store?: KeyValueStore | null) =>
  store === undefined ? createBrowserKeyValueStore() : store

const safeGet = (store: KeyValueStore | null, key: string): string | null => {
  if (!store) {
    return null
  }
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (store: KeyValueStore | null, key: string, value: string) => {
  if (!store) {
    return
  }
  try {
    store.setItem(key, value)
  } catch {
    // Ignore storage errors.
  }
}

const resolveDefaultLanguageId = (value: string | undefined): LanguageId => {
  return isLanguageId(value) ? value : DEFAULT_LANGUAGE_ID
}

export const useUserLanguagePreferenceWithPort = ({
  store,
  defaultLanguageId = DEFAULT_LANGUAGE_ID,
  port,
}: UseUserLanguagePreferenceWithPortArgs) => {
  const activeStore = getStore(store)
  const resolvedDefaultLanguageId = resolveDefaultLanguageId(defaultLanguageId)
  const [languageId, setLanguageIdState] = useState(() => {
    const stored = safeGet(activeStore, LANGUAGE_PREFERENCE_STORAGE_KEY)
    return isLanguageId(stored) ? stored : resolvedDefaultLanguageId
  })
  const [isHydratingLanguagePreference, setIsHydratingLanguagePreference] =
    useState(true)
  const hasInitializedFromServerRef = useRef(false)
  const { remotePreference, persistLanguagePreference } = port

  const persist = useCallback(
    (nextLanguageId: LanguageId) => {
      void persistLanguagePreference(nextLanguageId).catch((error) => {
        console.error('Failed to persist language preference', error)
      })
    },
    [persistLanguagePreference],
  )

  useEffect(() => {
    safeSet(activeStore, LANGUAGE_PREFERENCE_STORAGE_KEY, languageId)
  }, [activeStore, languageId])

  useEffect(() => {
    if (remotePreference === undefined || hasInitializedFromServerRef.current) {
      return
    }
    hasInitializedFromServerRef.current = true

    if (!remotePreference.isAuthenticated) {
      setIsHydratingLanguagePreference(false)
      return
    }

    if (isLanguageId(remotePreference.languageId)) {
      setLanguageIdState(remotePreference.languageId)
      setIsHydratingLanguagePreference(false)
      return
    }

    persist(languageId)
    setIsHydratingLanguagePreference(false)
  }, [languageId, persist, remotePreference])

  const setLanguageId = useCallback(
    (nextLanguageId: string) => {
      if (!isLanguageId(nextLanguageId)) {
        return
      }

      setLanguageIdState((currentLanguageId) => {
        if (currentLanguageId === nextLanguageId) {
          return currentLanguageId
        }
        if (hasInitializedFromServerRef.current) {
          persist(nextLanguageId)
        }
        return nextLanguageId
      })
    },
    [persist],
  )

  return {
    languageId,
    setLanguageId,
    isHydratingLanguagePreference,
  }
}

export const useUserLanguagePreference = ({
  store,
  defaultLanguageId = DEFAULT_LANGUAGE_ID,
}: UseUserLanguagePreferenceArgs = {}) => {
  const port = useConvexLanguagePreferencePort()
  return useUserLanguagePreferenceWithPort({
    store,
    defaultLanguageId,
    port,
  })
}
