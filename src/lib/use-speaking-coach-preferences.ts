import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_LANGUAGE_ID } from '../../shared/language-contract'
import type { KeyValueStore } from '@/lib/key-value-store'
import type { TranslationPreferences } from '@/lib/translation-preferences'
import type {
  SpeakingConversationMode,
  TeacherInputSourceMethod,
} from '@/lib/speaking-session-types'
import { parseTeacherInputSourceMethod } from '@/lib/speaking-session-types'
import { createBrowserKeyValueStore } from '@/lib/key-value-store'
import {
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  useUserLanguagePreference,
} from '@/lib/use-user-language-preference'
import {
  isConversationMode,
  parseConversationMode,
} from '@/lib/speaking-coach-mode-config'
import { parseTranslationPreferences } from '@/lib/translation-preferences'

export const SPEAKING_COACH_PREFERENCE_KEYS = {
  language: LANGUAGE_PREFERENCE_STORAGE_KEY,
  mode: 'glotcap-app-mode',
  learnerDevice: 'glotcap-app-learner-device',
  teacherDevice: 'glotcap-app-teacher-device',
  teacherSourceMethod: 'glotcap-app-teacher-source-method',
  translationPreferences: 'glotcap-app-translation-preferences',
} as const

type UseSpeakingCoachPreferencesArgs = {
  store?: KeyValueStore | null
  defaultLanguageId?: string
}

type TeacherInputSourceMethodUpdate =
  | TeacherInputSourceMethod
  | ((prev: TeacherInputSourceMethod) => TeacherInputSourceMethod)

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

const safeRemove = (store: KeyValueStore | null, key: string) => {
  if (!store) {
    return
  }
  try {
    store.removeItem(key)
  } catch {
    // Ignore storage errors.
  }
}

export const useSpeakingCoachPreferences = ({
  store,
  defaultLanguageId = DEFAULT_LANGUAGE_ID,
}: UseSpeakingCoachPreferencesArgs = {}) => {
  const activeStore = getStore(store)
  const initialTeacherSourceMethod = safeGet(
    activeStore,
    SPEAKING_COACH_PREFERENCE_KEYS.teacherSourceMethod,
  )
  const { languageId, setLanguageId, isHydratingLanguagePreference } =
    useUserLanguagePreference({
      store: activeStore,
      defaultLanguageId,
    })

  const [conversationMode, setConversationMode] =
    useState<SpeakingConversationMode>(() =>
      parseConversationMode(
        safeGet(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.mode),
      ),
    )
  const [learnerDeviceId, setLearnerDeviceId] = useState<string | null>(() =>
    safeGet(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.learnerDevice),
  )
  const [teacherDeviceId, setTeacherDeviceId] = useState<string | null>(() =>
    safeGet(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.teacherDevice),
  )
  const [teacherInputSourceMethod, setTeacherInputSourceMethodState] =
    useState<TeacherInputSourceMethod>(() =>
      parseTeacherInputSourceMethod(initialTeacherSourceMethod),
    )
  const [
    hasExplicitTeacherInputSourceMethod,
    setHasExplicitTeacherInputSourceMethod,
  ] = useState(() => initialTeacherSourceMethod !== null)
  const [initialTranslationPreferences] = useState(() =>
    parseTranslationPreferences(
      safeGet(
        activeStore,
        SPEAKING_COACH_PREFERENCE_KEYS.translationPreferences,
      ),
    ),
  )

  useEffect(() => {
    safeSet(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.mode, conversationMode)
  }, [activeStore, conversationMode])

  useEffect(() => {
    if (learnerDeviceId) {
      safeSet(
        activeStore,
        SPEAKING_COACH_PREFERENCE_KEYS.learnerDevice,
        learnerDeviceId,
      )
      return
    }
    safeRemove(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.learnerDevice)
  }, [activeStore, learnerDeviceId])

  useEffect(() => {
    if (teacherDeviceId) {
      safeSet(
        activeStore,
        SPEAKING_COACH_PREFERENCE_KEYS.teacherDevice,
        teacherDeviceId,
      )
      return
    }
    safeRemove(activeStore, SPEAKING_COACH_PREFERENCE_KEYS.teacherDevice)
  }, [activeStore, teacherDeviceId])

  useEffect(() => {
    safeSet(
      activeStore,
      SPEAKING_COACH_PREFERENCE_KEYS.teacherSourceMethod,
      teacherInputSourceMethod,
    )
  }, [activeStore, teacherInputSourceMethod])

  const setTeacherInputSourceMethod = useCallback(
    (value: TeacherInputSourceMethodUpdate) => {
      setHasExplicitTeacherInputSourceMethod(true)
      setTeacherInputSourceMethodState((current) =>
        typeof value === 'function'
          ? (
              value as (
                prev: TeacherInputSourceMethod,
              ) => TeacherInputSourceMethod
            )(current)
          : value,
      )
    },
    [],
  )

  const saveTranslationPreferences = useCallback(
    (preferences: TranslationPreferences) => {
      safeSet(
        activeStore,
        SPEAKING_COACH_PREFERENCE_KEYS.translationPreferences,
        JSON.stringify(preferences),
      )
    },
    [activeStore],
  )

  const handleConversationModeChange = useCallback((value: string | null) => {
    if (!isConversationMode(value)) {
      return
    }
    setConversationMode(value)
  }, [])

  return {
    conversationMode,
    setConversationMode,
    handleConversationModeChange,
    languageId,
    setLanguageId,
    learnerDeviceId,
    setLearnerDeviceId,
    teacherDeviceId,
    setTeacherDeviceId,
    teacherInputSourceMethod,
    setTeacherInputSourceMethod,
    hasExplicitTeacherInputSourceMethod,
    initialTranslationPreferences,
    saveTranslationPreferences,
    isHydratingLanguagePreference,
  }
}
