import { resolveTranscriptDelta } from './transcript-delta'
import type {
  SttClient,
  SttClientHandlers,
  SttCloseInfo,
  TranscriptEvent,
} from './types'

export type SonioxConfig = {
  api_key: string
  model: string
  audio_format: string
  sample_rate?: number
  num_channels?: number
  language_hints?: Array<string>
  enable_endpoint_detection?: boolean
  client_reference_id?: string
}

export type SonioxSttConfig = {
  provider: 'soniox'
  url: string
  config: SonioxConfig
}

type SonioxToken = {
  text?: string
  confidence?: number
  is_final?: boolean
}

type SonioxResponse = {
  tokens?: Array<SonioxToken>
  error_code?: number
  error_message?: string
  finished?: boolean
}

const sumConfidence = (tokens: Array<SonioxToken>) => {
  let sum = 0
  let count = 0
  for (const token of tokens) {
    if (typeof token.confidence === 'number') {
      sum += token.confidence
      count += 1
    }
  }
  return count > 0 ? sum / count : undefined
}

const buildTranscriptEvents = (
  tokens: Array<SonioxToken>,
  previousFinalText: string,
): { events: Array<TranscriptEvent>; nextFinalText: string } => {
  const finalTokens = tokens.filter((token) => token.is_final)
  const partialTokens = tokens.filter((token) => !token.is_final)

  const finalText = finalTokens.map((token) => token.text ?? '').join('')
  const partialText = partialTokens.map((token) => token.text ?? '').join('')
  const events: Array<TranscriptEvent> = []
  const finalDelta = resolveTranscriptDelta(previousFinalText, finalText)

  if (finalDelta.trim().length > 0) {
    events.push({
      text: finalDelta,
      isFinal: true,
      confidence: sumConfidence(finalTokens),
    })
  }

  if (partialText.trim().length > 0) {
    events.push({
      text: partialText,
      isFinal: false,
      confidence: sumConfidence(partialTokens),
    })
  }

  return {
    events,
    nextFinalText: finalText,
  }
}

export const createSonioxSttClient = (
  config: SonioxSttConfig,
  handlers: SttClientHandlers,
): SttClient => {
  const pending: Array<ArrayBuffer> = []
  let socket: WebSocket | null = null
  let ready = false
  let hadError = false
  let openedAt: number | null = null
  let wasOpen = false
  let lastClose: SttCloseInfo | null = null
  let lastFinalText = ''

  const buildDiagnostics = () => ({
    readyState: socket?.readyState ?? null,
    wasOpen,
    openedAt,
    elapsedMs: openedAt ? Date.now() - openedAt : null,
    close: lastClose,
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
  })

  const flush = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !ready) {
      return
    }

    while (pending.length > 0) {
      const chunk = pending.shift()
      if (chunk) {
        socket.send(chunk)
      }
    }
  }

  const open = () => {
    handlers.onStatus?.('connecting')
    socket = new WebSocket(config.url)
    socket.binaryType = 'arraybuffer'

    socket.onopen = () => {
      ready = false
      wasOpen = true
      openedAt = Date.now()
      handlers.onStatus?.('open')
      socket?.send(JSON.stringify(config.config))
      ready = true
      handlers.onStatus?.('ready')
      flush()
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      try {
        const payload = JSON.parse(event.data) as SonioxResponse

        if (payload.error_code || payload.error_message) {
          const error = new Error(payload.error_message ?? 'STT service error')
          ;(
            error as Error & {
              code?: string
              details?: Record<string, unknown>
            }
          ).code = 'STT_SERVICE'
          ;(error as Error & { details?: Record<string, unknown> }).details = {
            payload,
            ...buildDiagnostics(),
          }
          handlers.onError?.(error)
          hadError = true
          socket?.close()
          return
        }

        if (payload.finished) {
          return
        }

        if (payload.tokens && payload.tokens.length > 0) {
          const { events, nextFinalText } = buildTranscriptEvents(
            payload.tokens,
            lastFinalText,
          )
          lastFinalText = nextFinalText
          events.forEach((eventPayload) => handlers.onTranscript(eventPayload))
        }
      } catch (err) {
        const parseError = err instanceof Error ? err : new Error('STT error')
        ;(
          parseError as Error & {
            code?: string
            details?: Record<string, unknown>
          }
        ).code = (parseError as Error & { code?: string }).code ?? 'STT_PARSE'
        ;(parseError as Error & { details?: Record<string, unknown> }).details =
          buildDiagnostics()
        handlers.onError?.(parseError)
      }
    }

    socket.onerror = () => {
      const error = new Error('STT connection error')
      ;(
        error as Error & { code?: string; details?: Record<string, unknown> }
      ).code = 'STT_CONNECTION'
      ;(error as Error & { details?: Record<string, unknown> }).details =
        buildDiagnostics()
      hadError = true
      handlers.onError?.(error)
    }

    socket.onclose = (event) => {
      ready = false
      handlers.onStatus?.('closed')
      lastClose = {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      }
      handlers.onClose?.(lastClose)
      if (!event.wasClean && !hadError) {
        const error = new Error('STT connection closed')
        ;(
          error as Error & { code?: string; details?: Record<string, unknown> }
        ).code = 'STT_CONNECTION'
        ;(error as Error & { details?: Record<string, unknown> }).details =
          buildDiagnostics()
        handlers.onError?.(error)
      }
    }
  }

  open()

  return {
    sendAudio: (audio: ArrayBuffer) => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !ready) {
        pending.push(audio)
        return
      }
      socket.send(audio)
    },
    close: () => {
      if (!socket) {
        return
      }

      try {
        socket.send('')
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error('STT error'))
      }

      socket.close()
      socket = null
      ready = false
      lastFinalText = ''
    },
    isReady: () => ready,
  }
}
