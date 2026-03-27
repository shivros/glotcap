type PlaybackItem = {
  audio: HTMLAudioElement
  url: string
  mimeType: string
  stream?: ReadableStream<Uint8Array>
  cancel?: () => void
  reader?: ReadableStreamDefaultReader<Uint8Array>
  mediaSource?: MediaSource
  sourceBuffer?: SourceBuffer
  appendQueue?: Array<Uint8Array>
  streamDone?: boolean
  didStart?: boolean
}

export type AudioPlaybackQueue = {
  enqueue: (audio: ArrayBuffer, mimeType: string) => void
  enqueueStream: (
    stream: ReadableStream<Uint8Array>,
    mimeType: string,
    cancel?: () => void,
  ) => void
  stop: () => void
  isPlaying: () => boolean
}

export const createAudioPlaybackQueue = (): AudioPlaybackQueue => {
  const queue: Array<PlaybackItem> = []
  let active: PlaybackItem | null = null
  let stopped = false

  const toArrayBuffer = (chunk: Uint8Array): ArrayBuffer => {
    if (chunk.buffer instanceof ArrayBuffer) {
      if (
        chunk.byteOffset === 0 &&
        chunk.byteLength === chunk.buffer.byteLength
      ) {
        return chunk.buffer
      }
      return chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      )
    }
    const copy = new Uint8Array(chunk.byteLength)
    copy.set(chunk)
    return copy.buffer
  }

  const cleanup = (item: PlaybackItem) => {
    try {
      item.audio.pause()
    } catch {
      // Ignore pause errors.
    }
    if (item.reader) {
      try {
        void item.reader.cancel()
      } catch {
        // Ignore cancel errors.
      }
      item.reader = undefined
    }
    if (item.cancel) {
      try {
        item.cancel()
      } catch {
        // Ignore cancel errors.
      }
      item.cancel = undefined
    }
    if (item.mediaSource && item.mediaSource.readyState === 'open') {
      try {
        item.mediaSource.endOfStream()
      } catch {
        // Ignore endOfStream errors.
      }
    }
    item.audio.src = ''
    if (item.url) {
      URL.revokeObjectURL(item.url)
    }
  }

  const playNext = () => {
    if (active || queue.length === 0 || stopped) {
      return
    }

    const next = queue.shift()
    if (!next) {
      return
    }

    active = next
    next.audio.onended = () => {
      const finished = active
      active = null
      if (finished) {
        cleanup(finished)
      }
      playNext()
    }

    if (next.stream) {
      void playStream(next)
      return
    }

    void next.audio.play().catch((err) => {
      console.error('Audio playback failed', err)
      const failed = active
      active = null
      if (failed) {
        cleanup(failed)
      }
      playNext()
    })
  }

  const enqueue = (audio: ArrayBuffer, mimeType: string) => {
    if (stopped) {
      stopped = false
    }

    const blob = new Blob([audio], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const element = new Audio(url)
    const item = { audio: element, url, mimeType }
    queue.push(item)
    playNext()
  }

  const readStreamToBuffer = async (item: PlaybackItem) => {
    if (!item.stream) {
      return
    }
    const reader = item.stream.getReader()
    item.reader = reader
    const chunks: Array<Uint8Array> = []
    let totalLength = 0
    let isDone = false
    while (!isDone) {
      const { value, done } = await reader.read()
      isDone = done
      if (value) {
        chunks.push(value)
        totalLength += value.byteLength
      }
    }

    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }

    const blob = new Blob([merged], { type: item.mimeType })
    item.url = URL.createObjectURL(blob)
    item.audio.src = item.url
    await item.audio.play()
  }

  const flushSourceBuffer = (item: PlaybackItem) => {
    if (!item.sourceBuffer || item.sourceBuffer.updating) {
      return
    }
    const appendQueue = item.appendQueue ?? []
    if (appendQueue.length === 0) {
      if (item.streamDone && item.mediaSource?.readyState === 'open') {
        try {
          item.mediaSource.endOfStream()
        } catch {
          // Ignore endOfStream errors.
        }
      }
      return
    }
    const nextChunk = appendQueue.shift()
    if (!nextChunk) {
      return
    }
    item.sourceBuffer.appendBuffer(toArrayBuffer(nextChunk))
    if (!item.didStart) {
      item.didStart = true
      void item.audio.play().catch((err) => {
        console.error('Audio playback failed', err)
        const failed = active
        active = null
        if (failed) {
          cleanup(failed)
        }
        playNext()
      })
    }
  }

  const playStream = async (item: PlaybackItem) => {
    if (!item.stream) {
      return
    }

    if (
      typeof MediaSource === 'undefined' ||
      !MediaSource.isTypeSupported(item.mimeType)
    ) {
      try {
        await readStreamToBuffer(item)
      } catch (err) {
        console.error('Audio playback failed', err)
        const failed = active
        active = null
        if (failed) {
          cleanup(failed)
        }
        playNext()
      }
      return
    }

    const mediaSource = new MediaSource()
    item.mediaSource = mediaSource
    item.url = URL.createObjectURL(mediaSource)
    item.audio.src = item.url
    item.appendQueue = []

    mediaSource.addEventListener('sourceopen', () => {
      if (!item.mediaSource || !item.stream) {
        return
      }
      try {
        item.sourceBuffer = item.mediaSource.addSourceBuffer(item.mimeType)
      } catch (err) {
        console.error('Audio source buffer failed', err)
        const failed = active
        active = null
        if (failed) {
          cleanup(failed)
        }
        playNext()
        return
      }

      item.sourceBuffer.addEventListener('updateend', () =>
        flushSourceBuffer(item),
      )

      const reader = item.stream.getReader()
      item.reader = reader

      const pump = async () => {
        try {
          const { value, done } = await reader.read()
          if (stopped) {
            return
          }
          if (done) {
            item.streamDone = true
            flushSourceBuffer(item)
            return
          }
          item.appendQueue?.push(value)
          flushSourceBuffer(item)
          await pump()
        } catch (err) {
          console.error('Audio playback failed', err)
          const failed = active
          active = null
          if (failed) {
            cleanup(failed)
          }
          playNext()
        }
      }

      void pump()
    })
  }

  const enqueueStream = (
    stream: ReadableStream<Uint8Array>,
    mimeType: string,
    cancel?: () => void,
  ) => {
    if (stopped) {
      stopped = false
    }

    const element = new Audio()
    const item: PlaybackItem = {
      audio: element,
      url: '',
      mimeType,
      stream,
      cancel,
    }
    queue.push(item)
    playNext()
  }

  const stop = () => {
    stopped = true
    if (active) {
      cleanup(active)
      active = null
    }
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        cleanup(item)
      }
    }
  }

  return {
    enqueue,
    enqueueStream,
    stop,
    isPlaying: () => Boolean(active),
  }
}
