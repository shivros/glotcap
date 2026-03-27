import { useStream } from '@convex-dev/persistent-text-streaming/react'
import { usePersistentTextStream } from 'ts-common/streaming/react'
import { api } from '../../convex/_generated/api'

type UseCoachStreamOptions = {
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

export const useCoachStream = ({
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
}: UseCoachStreamOptions) => {
  return usePersistentTextStream({
    useStreamHook: (streamQuery, targetStreamUrl, driven, currentStreamId) =>
      useStream(
        streamQuery as never,
        targetStreamUrl,
        driven,
        currentStreamId as never,
      ),
    streamQuery: api.streaming.getStreamBody,
    streamId,
    streamUrl,
    isDriven,
    notifyOnComplete,
    onComplete,
    notifyOnSegment,
    onSegment,
    notifyOnDelta,
    onDelta,
    maxSegmentWaitMs,
  })
}
