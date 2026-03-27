type SentenceChunkerOptions = {
  maxBufferLength?: number
}

type SentenceChunker = {
  push: (text: string) => Array<string>
  flush: () => string | null
  reset: () => void
  hasPending: () => boolean
}

const DEFAULT_MAX_BUFFER = 260
const SENTENCE_ENDINGS = new Set(['.', '!', '?'])
const TRAILING_ENDINGS = new Set(['"', "'", ')', ']', '}'])

const isWhitespace = (value: string) => /\s/.test(value)

const findSentenceBoundary = (buffer: string) => {
  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i]
    if (!char) {
      continue
    }
    if (char === '\n') {
      return i
    }
    if (SENTENCE_ENDINGS.has(char)) {
      let end = i + 1
      while (end < buffer.length) {
        const trailing = buffer[end]
        if (!trailing || !TRAILING_ENDINGS.has(trailing)) {
          break
        }
        end += 1
      }
      const nextChar = buffer[end]
      if (end >= buffer.length || (nextChar && isWhitespace(nextChar))) {
        return end
      }
    }
  }
  return null
}

const splitAt = (buffer: string, index: number) => {
  const segment = buffer.slice(0, index).trim()
  const rest = buffer.slice(index).trimStart()
  return { segment, rest }
}

const splitFallback = (buffer: string, maxBufferLength: number) => {
  if (buffer.length < maxBufferLength) {
    return null
  }
  const cutoff = buffer.lastIndexOf(' ', maxBufferLength)
  if (cutoff <= 0) {
    return null
  }
  return splitAt(buffer, cutoff)
}

export const createSentenceChunker = (
  options: SentenceChunkerOptions = {},
): SentenceChunker => {
  let buffer = ''
  const maxBufferLength = options.maxBufferLength ?? DEFAULT_MAX_BUFFER

  const push = (text: string) => {
    if (!text) {
      return []
    }
    buffer += text

    const segments: Array<string> = []

    while (buffer.length > 0) {
      const boundary = findSentenceBoundary(buffer)
      if (boundary !== null) {
        const { segment, rest } = splitAt(buffer, boundary + 1)
        buffer = rest
        if (segment) {
          segments.push(segment)
        }
        continue
      }

      const fallback = splitFallback(buffer, maxBufferLength)
      if (fallback) {
        buffer = fallback.rest
        if (fallback.segment) {
          segments.push(fallback.segment)
        }
      }
      break
    }

    return segments
  }

  const flush = () => {
    const output = buffer.trim()
    buffer = ''
    return output.length > 0 ? output : null
  }

  const reset = () => {
    buffer = ''
  }

  const hasPending = () => buffer.trim().length > 0

  return { push, flush, reset, hasPending }
}
