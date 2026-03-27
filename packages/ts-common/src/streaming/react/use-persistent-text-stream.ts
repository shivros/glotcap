import { useEffect, useRef } from 'react'
import { createSentenceChunker } from '../../speech/tts'

type PersistentTextStatus = 'streaming' | 'done' | 'error' | string

type PersistentTextStreamState = {
  text: string
  status: PersistentTextStatus
}

export type UsePersistentTextStreamHook<TStreamQuery> = (
  streamQuery: TStreamQuery,
  streamUrl: URL,
  isDriven: boolean,
  streamId?: string,
  options?: Record<string, unknown>,
) => PersistentTextStreamState & Record<string, unknown>

export type UsePersistentTextStreamOptions<TStreamQuery> = {
  useStreamHook: UsePersistentTextStreamHook<TStreamQuery>
  streamQuery: TStreamQuery
  streamId?: string
  streamUrl: URL
  isDriven?: boolean
  notifyOnComplete?: boolean
  onComplete?: (streamId: string, text: string, status: string) => void
  notifyOnSegment?: boolean
  onSegment?: (streamId: string, segment: string, isFinal: boolean) => void
  notifyOnDelta?: boolean
  onDelta?: (streamId: string, delta: string) => void
  maxSegmentWaitMs?: number
}

export const computeTextDelta = (previousText: string, currentText: string) => {
  if (currentText.startsWith(previousText)) {
    return currentText.slice(previousText.length)
  }
  return currentText
}

export const usePersistentTextStream = <TStreamQuery>({
  useStreamHook,
  streamQuery,
  streamId,
  streamUrl,
  isDriven = false,
  notifyOnComplete = true,
  onComplete,
  notifyOnSegment = false,
  onSegment,
  notifyOnDelta = false,
  onDelta,
  maxSegmentWaitMs = 800,
}: UsePersistentTextStreamOptions<TStreamQuery>) => {
  const stream = useStreamHook(streamQuery, streamUrl, isDriven, streamId)
  const notifiedRef = useRef<string | null>(null)
  const chunkerRef = useRef(createSentenceChunker())
  const lastTextRef = useRef('')
  const segmentTimerRef = useRef<number | null>(null)

  useEffect(() => {
    chunkerRef.current.reset()
    lastTextRef.current = ''
    notifiedRef.current = null
    if (segmentTimerRef.current) {
      window.clearTimeout(segmentTimerRef.current)
      segmentTimerRef.current = null
    }
  }, [streamId])

  useEffect(
    () => () => {
      if (segmentTimerRef.current) {
        window.clearTimeout(segmentTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!streamId) {
      return
    }

    const shouldNotifySegments = isDriven && notifyOnSegment && onSegment
    const shouldNotifyDelta = isDriven && notifyOnDelta && onDelta
    if (shouldNotifySegments || shouldNotifyDelta) {
      const currentText = stream.text
      const delta = computeTextDelta(lastTextRef.current, currentText)
      if (!currentText.startsWith(lastTextRef.current)) {
        chunkerRef.current.reset()
      }
      lastTextRef.current = currentText

      if (shouldNotifyDelta && delta) {
        onDelta(streamId, delta)
      }

      if (delta && shouldNotifySegments) {
        const segments = chunkerRef.current.push(delta)
        segments.forEach((segment) => {
          onSegment(streamId, segment, false)
        })
      }

      if (shouldNotifySegments) {
        if (stream.status === 'done' || stream.status === 'error') {
          if (segmentTimerRef.current) {
            window.clearTimeout(segmentTimerRef.current)
            segmentTimerRef.current = null
          }
          const finalSegment = chunkerRef.current.flush()
          if (finalSegment) {
            onSegment(streamId, finalSegment, true)
          }
        } else if (maxSegmentWaitMs > 0 && chunkerRef.current.hasPending()) {
          if (segmentTimerRef.current) {
            window.clearTimeout(segmentTimerRef.current)
          }
          segmentTimerRef.current = window.setTimeout(() => {
            segmentTimerRef.current = null
            const timedSegment = chunkerRef.current.flush()
            if (timedSegment) {
              onSegment(streamId, timedSegment, false)
            }
          }, maxSegmentWaitMs)
        }
      }
    }

    if (!notifyOnComplete || !onComplete) {
      return
    }

    if (stream.status === 'done' || stream.status === 'error') {
      if (notifiedRef.current === streamId) {
        return
      }
      notifiedRef.current = streamId
      onComplete(streamId, stream.text, stream.status)
    }
  }, [
    isDriven,
    maxSegmentWaitMs,
    notifyOnComplete,
    notifyOnDelta,
    notifyOnSegment,
    onComplete,
    onDelta,
    onSegment,
    stream.status,
    stream.text,
    streamId,
  ])

  return stream
}
