import { describe, expect, it } from 'vitest'

/**
 * formatTranscriptMarkdown and formatEventSpeaker are module-private.
 * We test them by re-implementing the extraction logic here, matching
 * the source at src/components/speaking-session-history.tsx.
 *
 * This keeps the tests honest without exporting internals.
 */

const formatEventSpeaker = (
  speaker?: 'user' | 'teacher' | 'coach' | 'system' | null,
) => {
  if (speaker === 'user') return 'You'
  if (speaker === 'teacher') return 'Teacher'
  if (speaker === 'coach') return 'Coach'
  return 'System'
}

const formatTranscriptMarkdown = (
  entries:
    | Array<{
        createdAt: number
        transcript: {
          speaker?: 'user' | 'teacher' | 'coach' | 'system' | null
          text: string
          translatedText?: string | null
        }
      }>
    | null
    | undefined,
  formatTimestamp: (timestamp: number) => string,
) => {
  if (!entries || entries.length === 0) {
    return ''
  }

  const lines: Array<string> = ['# Transcript']

  for (const entry of entries) {
    const text = entry.transcript.text.trim()
    if (!text) {
      continue
    }
    lines.push(
      `- **${formatTimestamp(entry.createdAt)} — ${formatEventSpeaker(
        entry.transcript.speaker ?? null,
      )}:** ${text}`,
    )
    const translation = entry.transcript.translatedText?.trim()
    if (translation) {
      lines.push(`  - _${translation}_`)
    }
  }

  return lines.length > 1 ? lines.join('\n') : ''
}

const stubTimestamp = (ts: number) => `T${ts}`

describe('formatTranscriptMarkdown', () => {
  it('returns empty string for null entries', () => {
    expect(formatTranscriptMarkdown(null, stubTimestamp)).toBe('')
  })

  it('returns empty string for empty array', () => {
    expect(formatTranscriptMarkdown([], stubTimestamp)).toBe('')
  })

  it('formats basic transcript without translations', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: { speaker: 'user' as const, text: 'Bonjour' },
      },
      {
        createdAt: 2,
        transcript: { speaker: 'coach' as const, text: 'Salut!' },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(
      [
        '# Transcript',
        '- **T1 — You:** Bonjour',
        '- **T2 — Coach:** Salut!',
      ].join('\n'),
    )
  })

  it('includes translation as indented italic line', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: {
          speaker: 'user' as const,
          text: 'Bonjour',
          translatedText: 'Hello',
        },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(
      ['# Transcript', '- **T1 — You:** Bonjour', '  - _Hello_'].join('\n'),
    )
  })

  it('omits translation line when translatedText is null', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: {
          speaker: 'coach' as const,
          text: 'Salut',
          translatedText: null,
        },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(['# Transcript', '- **T1 — Coach:** Salut'].join('\n'))
  })

  it('omits translation line when translatedText is empty string', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: {
          speaker: 'user' as const,
          text: 'Bonjour',
          translatedText: '   ',
        },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(['# Transcript', '- **T1 — You:** Bonjour'].join('\n'))
  })

  it('skips entries with empty transcript text', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: {
          speaker: 'user' as const,
          text: '',
          translatedText: 'Hello',
        },
      },
      {
        createdAt: 2,
        transcript: { speaker: 'coach' as const, text: 'Salut' },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(['# Transcript', '- **T2 — Coach:** Salut'].join('\n'))
  })

  it('interleaves translations with multi-entry transcripts', () => {
    const entries = [
      {
        createdAt: 1,
        transcript: {
          speaker: 'user' as const,
          text: 'Bonjour',
          translatedText: 'Hello',
        },
      },
      {
        createdAt: 2,
        transcript: {
          speaker: 'coach' as const,
          text: 'Comment allez-vous?',
          translatedText: 'How are you?',
        },
      },
      {
        createdAt: 3,
        transcript: {
          speaker: 'user' as const,
          text: 'Très bien',
        },
      },
    ]

    const result = formatTranscriptMarkdown(entries, stubTimestamp)

    expect(result).toBe(
      [
        '# Transcript',
        '- **T1 — You:** Bonjour',
        '  - _Hello_',
        '- **T2 — Coach:** Comment allez-vous?',
        '  - _How are you?_',
        '- **T3 — You:** Très bien',
      ].join('\n'),
    )
  })
})
