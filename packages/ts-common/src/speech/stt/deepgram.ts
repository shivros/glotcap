import { resolveTranscriptDelta } from './transcript-delta'
import type {
  SttClient,
  SttClientHandlers,
  SttCloseInfo,
  TranscriptEvent,
} from './types'

export type DeepgramConfig = {
  access_token: string
  model: string
  language?: string
  encoding: 'linear16'
  sample_rate: number
  channels: number
  interim_results: boolean
  punctuate?: boolean
  smart_format?: boolean
  endpointing?: boolean | number
}

export type DeepgramSttConfig = {
  provider: 'deepgram'
  url: string
  config: DeepgramConfig
}

type DeepgramAlternative = {
  transcript?: string
  confidence?: number
}

type DeepgramResultPayload = {
  type?: string
  is_final?: boolean
  speech_final?: boolean
  channel?: {
    alternatives?: Array<DeepgramAlternative>
  }
  err_msg?: string
}

type DeepgramAuthMode = 'bearer_protocol' | 'token_protocol' | 'query_token'

const toQueryValue = (value: string | number | boolean | undefined) => {
  if (value === undefined) {
    return null
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return String(value)
}

const buildDeepgramWsUrl = (
  config: DeepgramSttConfig,
  authMode: DeepgramAuthMode,
) => {
  const url = new URL(config.url)
  const query = [
    ['model', config.config.model],
    ['encoding', config.config.encoding],
    ['sample_rate', config.config.sample_rate],
    ['channels', config.config.channels],
    ['interim_results', config.config.interim_results],
    ['language', config.config.language],
    ['punctuate', config.config.punctuate],
    ['smart_format', config.config.smart_format],
    ['endpointing', config.config.endpointing],
  ] as const

  for (const [key, value] of query) {
    const normalized = toQueryValue(value)
    if (normalized !== null) {
      url.searchParams.set(key, normalized)
    }
  }

  if (authMode === 'query_token') {
    // Fallback auth mode for environments where subprotocol auth is rejected.
    url.searchParams.set('token', config.config.access_token)
  }

  return url.toString()
}

export const parseTranscriptEvent = (
  payload: DeepgramResultPayload,
  previousFinalText: string,
): { event: TranscriptEvent | null; nextFinalText: string } => {
  const transcript =
    payload.channel?.alternatives?.[0]?.transcript?.trim() ?? ''
  const isSpeechFinal = Boolean(payload.speech_final)

  if (!transcript) {
    return {
      event: null,
      // Reset delta tracking at utterance boundary so the next utterance
      // isn't compared against unrelated text from the previous one.
      nextFinalText: isSpeechFinal ? '' : previousFinalText,
    }
  }

  const isFinal = Boolean(payload.is_final)
  const nextText = isFinal
    ? resolveTranscriptDelta(previousFinalText, transcript)
    : transcript

  // After a speech_final boundary, reset so the next utterance starts clean.
  const nextFinalText = isSpeechFinal
    ? ''
    : isFinal
      ? transcript
      : previousFinalText

  if (!nextText) {
    return {
      event: null,
      nextFinalText,
    }
  }

  return {
    event: {
      text: nextText,
      isFinal,
      confidence: payload.channel?.alternatives?.[0]?.confidence,
    },
    nextFinalText,
  }
}

export const createDeepgramSttClient = (
  config: DeepgramSttConfig,
  handlers: SttClientHandlers,
): SttClient => {
  const pending: Array<ArrayBuffer> = []
  let socket: WebSocket | null = null
  let ready = false
  let hadError = false
  let openedAt: number | null = null
  let wasOpen = false
  let lastClose: SttCloseInfo | null = null
  let closedExplicitly = false
  let lastFinalText = ''
  const authModes: Array<DeepgramAuthMode> = [
    'bearer_protocol',
    'token_protocol',
    'query_token',
  ]
  let authModeIndex = 0
  let connectedInCurrentAttempt = false
  const getAuthMode = (): DeepgramAuthMode =>
    authModes[authModeIndex] ?? 'query_token'

  const buildDiagnostics = () => ({
    readyState: socket?.readyState ?? null,
    wasOpen,
    openedAt,
    elapsedMs: openedAt ? Date.now() - openedAt : null,
    close: lastClose,
    authMode: getAuthMode(),
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

  const shouldRetryWithNextAuthMode = (closeInfo: SttCloseInfo) => {
    if (closedExplicitly) {
      return false
    }
    if (authModeIndex >= authModes.length - 1) {
      return false
    }

    const reason = closeInfo.reason.toLowerCase()
    const authCloseCode = closeInfo.code === 1008 || closeInfo.code === 4401
    const authReason =
      reason.includes('auth') ||
      reason.includes('unauthorized') ||
      reason.includes('forbidden') ||
      reason.includes('token')

    // If we fail before ever establishing a connected stream, treat that as
    // auth-handshake uncertainty and try the next supported auth mode.
    return authCloseCode || authReason || !connectedInCurrentAttempt
  }

  const open = () => {
    handlers.onStatus?.('connecting')
    connectedInCurrentAttempt = false
    const authMode = getAuthMode()
    const wsUrl = buildDeepgramWsUrl(config, authMode)
    socket =
      authMode === 'query_token'
        ? new WebSocket(wsUrl)
        : new WebSocket(wsUrl, [
            authMode === 'bearer_protocol' ? 'bearer' : 'token',
            config.config.access_token,
          ])
    socket.binaryType = 'arraybuffer'

    socket.onopen = () => {
      ready = true
      wasOpen = true
      connectedInCurrentAttempt = true
      openedAt = Date.now()
      handlers.onStatus?.('open')
      handlers.onStatus?.('ready')
      flush()
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      try {
        const payload = JSON.parse(event.data) as DeepgramResultPayload

        if (payload.type === 'Error' || payload.err_msg) {
          const error = new Error(payload.err_msg ?? 'STT service error')
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

        const { event: transcriptEvent, nextFinalText } = parseTranscriptEvent(
          payload,
          lastFinalText,
        )
        lastFinalText = nextFinalText
        if (transcriptEvent) {
          handlers.onTranscript(transcriptEvent)
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
      const error = new Error(`STT connection error (${getAuthMode()})`)
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
      lastClose = {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      }
      if (shouldRetryWithNextAuthMode(lastClose)) {
        authModeIndex += 1
        hadError = false
        open()
        return
      }
      handlers.onStatus?.('closed')
      handlers.onClose?.(lastClose)
      if (!event.wasClean && !hadError) {
        const reasonSuffix = event.reason
          ? ` (${event.code}: ${event.reason})`
          : ` (${event.code})`
        const error = new Error(`STT connection closed${reasonSuffix}`)
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
      closedExplicitly = true

      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'Finalize' }))
        }
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
