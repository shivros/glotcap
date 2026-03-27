import { describe, expect, it } from 'vitest'
import type { TranslationFeedEvent } from '@/lib/translation-feed-observer'
import { observeTranscriptUpdates } from '@/lib/translation-feed-observer'

const buildTranscriptEvent = (
  overrides: Partial<TranslationFeedEvent> = {},
): TranslationFeedEvent => ({
  _id: 'event-1',
  createdAt: 1000,
  type: 'transcript',
  speaker: 'teacher',
  streamId: null,
  text: 'privet',
  ...overrides,
})

describe('observeTranscriptUpdates', () => {
  it('deduplicates unchanged transcript snapshots', () => {
    const snapshotStore = new Map<string, string>()
    const feed = [buildTranscriptEvent()]
    const speakers = new Set(['teacher'])

    const first = observeTranscriptUpdates({
      feed,
      speakers,
      snapshotStore,
      nowMs: 3000,
    })
    const second = observeTranscriptUpdates({
      feed,
      speakers,
      snapshotStore,
      nowMs: 3500,
    })

    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      sourceId: 'event-1',
      speaker: 'teacher',
      cleanedText: 'privet',
      sourceChars: 6,
      sourceAgeMs: 2000,
    })
    expect(second).toEqual([])
  })

  it('emits a new observation when text changes for the same source', () => {
    const snapshotStore = new Map<string, string>()
    const speakers = new Set(['teacher'])

    observeTranscriptUpdates({
      feed: [buildTranscriptEvent({ text: 'privet' })],
      speakers,
      snapshotStore,
      nowMs: 2000,
    })

    const next = observeTranscriptUpdates({
      feed: [buildTranscriptEvent({ text: 'privet kak dela' })],
      speakers,
      snapshotStore,
      nowMs: 4000,
    })

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      sourceId: 'event-1',
      cleanedText: 'privet kak dela',
      sourceChars: 15,
    })
  })

  it('filters out non-counterpart, non-transcript, and stream events', () => {
    const snapshotStore = new Map<string, string>()
    const feed = [
      buildTranscriptEvent({ _id: 'teacher-ok', speaker: 'teacher' }),
      buildTranscriptEvent({ _id: 'learner', speaker: 'user' }),
      buildTranscriptEvent({ _id: 'streamed', streamId: 'stream-1' }),
      buildTranscriptEvent({ _id: 'correction', type: 'correction' }),
    ]

    const observations = observeTranscriptUpdates({
      feed,
      speakers: new Set(['teacher']),
      snapshotStore,
      nowMs: 2000,
    })

    expect(observations).toHaveLength(1)
    expect(observations[0]?.sourceId).toBe('teacher-ok')
  })

  it('supports observing multiple speakers in one pass', () => {
    const snapshotStore = new Map<string, string>()
    const feed = [
      buildTranscriptEvent({
        _id: 'teacher-event',
        speaker: 'teacher',
        text: 'bonjour',
      }),
      buildTranscriptEvent({
        _id: 'user-event',
        speaker: 'user',
        text: 'salut',
      }),
    ]

    const observations = observeTranscriptUpdates({
      feed,
      speakers: new Set(['teacher', 'user']),
      snapshotStore,
      nowMs: 5000,
    })

    expect(observations).toHaveLength(2)
    expect(observations[0]).toMatchObject({
      sourceId: 'teacher-event',
      speaker: 'teacher',
    })
    expect(observations[1]).toMatchObject({
      sourceId: 'user-event',
      speaker: 'user',
    })
  })
})
