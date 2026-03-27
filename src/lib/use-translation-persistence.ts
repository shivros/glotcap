import { useMutation } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

type TranslationPersistenceFeed = Array<Doc<'speakingEvents'>> | null

const resolveEventIdFromFeed = (
  feed: TranslationPersistenceFeed,
  sourceId: string,
): Id<'speakingEvents'> | null => {
  if (!feed) return null
  const direct = feed.find((e) => e._id === sourceId)
  if (direct) return direct._id
  const byStream = feed.find((e) => e.streamId === sourceId)
  if (byStream) return byStream._id
  return null
}

/**
 * Persists translations to the database as they are produced.
 *
 * Returns a `persist(sourceId, translatedText)` callback that resolves
 * the sourceId to a speakingEvent and writes the translation. Dedupes
 * identical writes via an internal ref.
 */
export const useTranslationPersistence = (feed: TranslationPersistenceFeed) => {
  const saveTranslation = useMutation(api.speaking.saveEventTranslation)
  const persistedRef = useRef<Map<string, string>>(new Map())

  const saveRef = useRef(saveTranslation)
  useEffect(() => {
    saveRef.current = saveTranslation
  }, [saveTranslation])

  const feedRef = useRef(feed)
  useEffect(() => {
    feedRef.current = feed
  }, [feed])

  const persist = useCallback((sourceId: string, translatedText: string) => {
    const previous = persistedRef.current.get(sourceId)
    if (previous === translatedText) return

    const eventId = resolveEventIdFromFeed(feedRef.current, sourceId)
    if (!eventId) return

    persistedRef.current.set(sourceId, translatedText)
    void saveRef.current({ eventId, translatedText })
  }, [])

  const reset = useCallback(() => {
    persistedRef.current.clear()
  }, [])

  return { persist, reset }
}
