export type BufferedBatcherOptions<TItem> = {
  flush: (batch: Array<TItem>) => Promise<void> | void
  batchMs?: number
  maxBatchSize?: number
  maxQueueSize?: number
  coalesce?: (queue: Array<TItem>, item: TItem) => void
  onError?: (error: unknown) => void
}

export type BufferedBatcher<TItem> = {
  enqueue: (item: TItem) => void
  enqueueMany: (items: Array<TItem>) => void
  flush: () => Promise<void>
  dispose: () => Promise<void>
  size: () => number
}

const DEFAULT_BATCH_MS = 250
const DEFAULT_MAX_BATCH_SIZE = 32
const DEFAULT_MAX_QUEUE_SIZE = 512

const defaultCoalesce = <TItem>(queue: Array<TItem>, item: TItem) => {
  queue.push(item)
}

export const createBufferedBatcher = <TItem>({
  flush,
  batchMs = DEFAULT_BATCH_MS,
  maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
  maxQueueSize = DEFAULT_MAX_QUEUE_SIZE,
  coalesce = defaultCoalesce,
  onError,
}: BufferedBatcherOptions<TItem>): BufferedBatcher<TItem> => {
  const safeBatchMs = Math.max(1, batchMs)
  const safeMaxBatchSize = Math.max(1, maxBatchSize)
  const safeMaxQueueSize = Math.max(1, maxQueueSize)

  let queue: Array<TItem> = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let flushInFlight: Promise<void> | null = null
  let disposed = false

  const clearTimer = () => {
    if (!timer) {
      return
    }
    clearTimeout(timer)
    timer = null
  }

  const scheduleFlush = () => {
    if (timer || disposed) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      void runFlush()
    }, safeBatchMs)
  }

  const runFlush = async () => {
    if (flushInFlight) {
      return flushInFlight
    }
    if (queue.length === 0) {
      return
    }

    clearTimer()

    flushInFlight = (async () => {
      try {
        while (queue.length > 0) {
          const batch = queue.splice(0, safeMaxBatchSize)
          try {
            await flush(batch)
          } catch (error) {
            if (onError) {
              onError(error)
            } else {
              console.error('Buffered batch flush failed', error)
            }
          }
        }
      } finally {
        flushInFlight = null
        if (!disposed && queue.length > 0) {
          scheduleFlush()
        }
      }
    })()

    return flushInFlight
  }

  const enqueueMany = (items: Array<TItem>) => {
    if (disposed || items.length === 0) {
      return
    }

    for (const item of items) {
      coalesce(queue, item)
    }

    if (queue.length > safeMaxQueueSize) {
      queue = queue.slice(queue.length - safeMaxQueueSize)
    }

    if (queue.length >= safeMaxBatchSize) {
      void runFlush()
      return
    }

    scheduleFlush()
  }

  return {
    enqueue: (item) => {
      enqueueMany([item])
    },
    enqueueMany,
    flush: async () => {
      await runFlush()
    },
    dispose: async () => {
      if (disposed) {
        return
      }
      clearTimer()
      await runFlush()
      disposed = true
      queue = []
    },
    size: () => queue.length,
  }
}
