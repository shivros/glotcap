import { describe, expect, it } from 'vitest'
import {
  createBilingualSegments,
  formatSrt,
  formatTranscript,
  parseSrt,
} from '../mediaToolsDomain'
import type { SubtitleSegment } from '../mediaToolsDomain'

describe('mediaToolsDomain', () => {
  it('parses and formats srt blocks', () => {
    const input = `1
00:00:00,000 --> 00:00:01,500
Hello world

2
00:00:01,600 --> 00:00:03,000
Second line`

    const segments = parseSrt(input)
    expect(segments).toHaveLength(2)
    expect(segments[0]?.startMs).toBe(0)
    expect(segments[1]?.endMs).toBe(3000)

    const formatted = formatSrt(segments)
    expect(formatted).toContain('00:00:00,000 --> 00:00:01,500')
    expect(formatted).toContain('Second line')
  })

  it('formats plain transcript from segments', () => {
    const segments: Array<SubtitleSegment> = [
      { segmentIndex: 1, originalText: 'One' },
      { segmentIndex: 2, originalText: 'Two' },
    ]

    expect(formatTranscript(segments)).toBe('One\nTwo')
  })

  it('builds bilingual segments with delimiter', () => {
    const segments: Array<SubtitleSegment> = [
      {
        segmentIndex: 1,
        startMs: 0,
        endMs: 1000,
        originalText: 'Hola',
        translatedText: 'Hello',
      },
    ]

    const bilingual = createBilingualSegments({
      segments,
      delimiter: '---',
    })

    expect(bilingual[0]?.originalText).toBe('Hola\n---\nHello')
  })

  it('ignores malformed srt blocks', () => {
    const input = `1
not-a-timestamp
Hello

2
00:00:01,000 --> 00:00:02,000
Valid`

    const segments = parseSrt(input)
    expect(segments).toHaveLength(1)
    expect(segments[0]?.originalText).toBe('Valid')
  })

  it('fills default timestamps when formatting srt without timings', () => {
    const segments: Array<SubtitleSegment> = [
      { segmentIndex: 1, originalText: 'One' },
      { segmentIndex: 2, originalText: 'Two' },
    ]

    const formatted = formatSrt(segments)
    expect(formatted).toContain('00:00:00,000 --> 00:00:02,000')
    expect(formatted).toContain('00:00:02,000 --> 00:00:04,000')
  })

  it('throws when bilingual segment has no translated text', () => {
    const segments: Array<SubtitleSegment> = [
      {
        segmentIndex: 1,
        originalText: 'Hola',
      },
    ]

    expect(() =>
      createBilingualSegments({
        segments,
        delimiter: '---',
      }),
    ).toThrow()
  })

  it('normalizes translated line breaks to source line count', () => {
    const segments: Array<SubtitleSegment> = [
      {
        segmentIndex: 1,
        originalText: 'line one\nline two',
        translatedText: 'uno\ndos\ntres',
      },
    ]

    const bilingual = createBilingualSegments({
      segments,
      delimiter: '---',
    })

    expect(bilingual[0]?.originalText).toBe(
      'line one\nline two\n---\nuno\ndos tres',
    )
  })
})
