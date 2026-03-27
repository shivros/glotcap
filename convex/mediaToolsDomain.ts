import { ConvexError } from 'convex/values'

const SRT_TIME_REGEX =
  /^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})$/

export type SubtitleSegment = {
  segmentIndex: number
  startMs?: number
  endMs?: number
  originalText: string
  translatedText?: string
}

const parseSrtTimestamp = (value: string) => {
  const match = value.trim().match(SRT_TIME_REGEX)
  if (!match) {
    return null
  }
  const [
    ,
    startHours,
    startMinutes,
    startSeconds,
    startMillis,
    endHours,
    endMinutes,
    endSeconds,
    endMillis,
  ] = match

  const toMs = (
    hours: string,
    minutes: string,
    seconds: string,
    millis: string,
  ) =>
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(millis)

  return {
    startMs: toMs(startHours, startMinutes, startSeconds, startMillis),
    endMs: toMs(endHours, endMinutes, endSeconds, endMillis),
  }
}

const formatSrtTimestamp = (ms: number) => {
  const safe = Math.max(0, Math.floor(ms))
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const millis = safe % 1_000

  const pad2 = (value: number) => String(value).padStart(2, '0')
  const pad3 = (value: number) => String(value).padStart(3, '0')

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`
}

export const parseSrt = (srt: string): Array<SubtitleSegment> => {
  const normalized = srt.replace(/\r/g, '').trim()
  if (normalized.length === 0) {
    return []
  }

  const rawBlocks = normalized.split(/\n\s*\n/g)
  const parsed: Array<SubtitleSegment> = []

  for (const block of rawBlocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)

    if (lines.length < 2) {
      continue
    }

    const parsedIndex = Number(lines[0])
    const timing = parseSrtTimestamp(lines[1])
    const textLines = lines.slice(2)

    if (!timing || textLines.length === 0) {
      continue
    }

    parsed.push({
      segmentIndex: Number.isFinite(parsedIndex)
        ? parsedIndex
        : parsed.length + 1,
      startMs: timing.startMs,
      endMs: timing.endMs,
      originalText: textLines.join('\n'),
    })
  }

  return parsed
}

const withDefaultTimestamps = (segments: Array<SubtitleSegment>) => {
  const defaultSegmentMs = 2_000
  let cursor = 0

  return segments.map((segment) => {
    const startMs = segment.startMs ?? cursor
    const endMs =
      segment.endMs ?? Math.max(startMs + defaultSegmentMs, cursor + 1)
    cursor = endMs
    return {
      ...segment,
      startMs,
      endMs,
    }
  })
}

export const formatSrt = (segments: Array<SubtitleSegment>) => {
  const normalized = withDefaultTimestamps(segments)
  return normalized
    .map((segment, index) => {
      const start = formatSrtTimestamp(segment.startMs)
      const end = formatSrtTimestamp(segment.endMs)
      const text = segment.originalText.trim()
      return `${index + 1}\n${start} --> ${end}\n${text}`
    })
    .join('\n\n')
}

export const formatTranscript = (segments: Array<SubtitleSegment>) =>
  segments
    .map((segment) => segment.originalText.trim())
    .filter((text) => text.length > 0)
    .join('\n')

const normalizeTranslatedLineBreaks = (
  original: string,
  translated: string,
) => {
  const originalLines = original.split('\n')
  const translatedLines = translated.split('\n')

  if (originalLines.length <= 1) {
    return translated.replace(/\n+/g, ' ').trim()
  }

  if (translatedLines.length === originalLines.length) {
    return translatedLines.map((line) => line.trim()).join('\n')
  }

  if (translatedLines.length < originalLines.length) {
    const padded = [...translatedLines]
    while (padded.length < originalLines.length) {
      padded.push('')
    }
    return padded.map((line) => line.trim()).join('\n')
  }

  const head = translatedLines.slice(0, originalLines.length - 1)
  const tail = translatedLines
    .slice(originalLines.length - 1)
    .join(' ')
    .trim()
  return [...head, tail].map((line) => line.trim()).join('\n')
}

export const createBilingualSegments = (args: {
  segments: Array<SubtitleSegment>
  delimiter: string
}) =>
  args.segments.map((segment) => {
    const translated = segment.translatedText?.trim()
    if (!translated) {
      throw new ConvexError({
        code: 'TRANSLATION_FAILED',
        message: `Missing translation for segment ${segment.segmentIndex}.`,
      })
    }

    const normalized = normalizeTranslatedLineBreaks(
      segment.originalText,
      translated,
    )

    return {
      ...segment,
      originalText: `${segment.originalText}\n${args.delimiter}\n${normalized}`,
    }
  })
