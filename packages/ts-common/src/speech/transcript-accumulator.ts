type TranscriptAccumulatorConfig<TFlushResult = void> = {
  onFlush: (text: string) => Promise<TFlushResult>
  onError?: (err: unknown) => void
  sanitize?: (text: string) => string
}

type TranscriptAccumulator<TFlushResult = void> = {
  append: (text: string) => void
  flush: () => Promise<TFlushResult | undefined>
  reset: () => void
  getText: () => string
  isEmpty: () => boolean
}

const mergeTranscriptText = (currentText: string, nextText: string) => {
  if (!currentText) {
    return nextText
  }
  if (currentText === nextText) {
    return currentText
  }
  if (nextText.startsWith(currentText)) {
    return nextText
  }
  if (currentText.startsWith(nextText)) {
    return currentText
  }

  const currentWords = currentText.split(/\s+/)
  const nextWords = nextText.split(/\s+/)
  const maxOverlap = Math.min(currentWords.length, nextWords.length)

  for (let overlapSize = maxOverlap; overlapSize > 0; overlapSize -= 1) {
    const currentSuffix = currentWords.slice(-overlapSize).join(' ')
    const nextPrefix = nextWords.slice(0, overlapSize).join(' ')
    if (currentSuffix === nextPrefix) {
      return [...currentWords, ...nextWords.slice(overlapSize)].join(' ').trim()
    }
  }

  return `${currentText} ${nextText}`.trim()
}

export function createTranscriptAccumulator<TFlushResult = void>(
  config: TranscriptAccumulatorConfig<TFlushResult>,
): TranscriptAccumulator<TFlushResult> {
  let segments: Array<string> = []
  let pending: Promise<unknown> = Promise.resolve()

  const append = (text: string) => {
    const cleaned = config.sanitize ? config.sanitize(text) : text
    const trimmed = cleaned.trim()
    if (trimmed) {
      const currentText = segments.join(' ').trim()
      segments = [currentText ? `${currentText} ${trimmed}` : trimmed]
    }
  }

  const flush = (): Promise<TFlushResult | undefined> => {
    const text = segments.join(' ').trim()
    segments = []

    if (!text) {
      return Promise.resolve(undefined)
    }

    const job = pending.then(async () => {
      try {
        return await config.onFlush(text)
      } catch (err) {
        if (config.onError) {
          config.onError(err)
        }
        return undefined
      }
    })

    pending = job
    return job
  }

  const reset = () => {
    segments = []
  }

  const getText = () => segments.join(' ').trim()

  const isEmpty = () => segments.length === 0 || getText() === ''

  return { append, flush, reset, getText, isEmpty }
}

export { mergeTranscriptText }
export type { TranscriptAccumulator, TranscriptAccumulatorConfig }
