import { sanitizeSpeechText } from '@/lib/speaking-session-text'

export type TranslationFeedEvent = {
  _id: string
  createdAt: number
  type: string
  speaker?: string | null
  streamId?: string | null
  text?: string | null
}

export type TranslationSourceObservation = {
  sourceId: string
  speaker: string
  cleanedText: string
  sourceChars: number
  sourceAgeMs: number
}

type ObserveTranscriptUpdatesArgs = {
  feed: Array<TranslationFeedEvent>
  speakers: Set<string>
  snapshotStore: Map<string, string>
  nowMs?: number
}

export const observeTranscriptUpdates = ({
  feed,
  speakers,
  snapshotStore,
  nowMs = Date.now(),
}: ObserveTranscriptUpdatesArgs): Array<TranslationSourceObservation> => {
  const observations: Array<TranslationSourceObservation> = []

  for (const event of feed) {
    if (event.type !== 'transcript') {
      continue
    }
    if (!event.speaker || !speakers.has(event.speaker)) {
      continue
    }
    if (event.streamId) {
      continue
    }

    const cleanedText = sanitizeSpeechText(event.text ?? '')
    if (!cleanedText) {
      continue
    }

    const previous = snapshotStore.get(event._id)
    if (previous === cleanedText) {
      continue
    }

    snapshotStore.set(event._id, cleanedText)
    observations.push({
      sourceId: event._id,
      speaker: event.speaker,
      cleanedText,
      sourceChars: cleanedText.length,
      sourceAgeMs: Math.max(0, nowMs - event.createdAt),
    })
  }

  return observations
}
