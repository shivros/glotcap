export type AppErrorSource =
  | 'convex'
  | 'network'
  | 'stt'
  | 'tts'
  | 'media'
  | 'unknown'

export type AppError = {
  code: string
  message: string
  source: AppErrorSource
  retryable: boolean
  details?: string
}

type ErrorLike = {
  message?: string
  code?: string
  data?: {
    code?: string
    message?: string
  }
}

const codeMessageMap: Record<string, string> = {
  STT_CONFIG_MISSING: 'Transcription is not configured yet.',
  STT_TOKEN_FAILED: 'Transcription service did not start. Try again soon.',
  STT_CONNECTION: 'We could not connect to the transcription service.',
  STT_SERVICE: 'The transcription service reported an error.',
  TTS_CONFIG_MISSING: 'Text-to-speech is not configured yet.',
  TTS_REQUEST_FAILED: 'Text-to-speech failed to start. Try again soon.',
  DEMO_LIMIT: 'Your demo time is up. Create an account to continue.',
  UNAUTHORIZED: 'Please sign in to continue.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  INVALID_ACCOUNT: 'Invalid credentials.',
  AUTH_CONFIG_MISSING: 'Authentication is not configured.',
  INVALID_INPUT: 'Some session details were missing. Try again.',
  NOT_FOUND: 'We could not find that session. Try again.',
}

const extractMessage = (error: unknown) => {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const maybeError = error as ErrorLike
    if (typeof maybeError.data?.message === 'string') {
      return maybeError.data.message
    }
    if (typeof maybeError.message === 'string') {
      return maybeError.message
    }
  }

  return ''
}

const sanitizeMessage = (message: string) => {
  let cleaned = message.trim()

  const uncaughtIndex = cleaned.indexOf('Uncaught Error:')
  if (uncaughtIndex !== -1) {
    cleaned = cleaned.slice(uncaughtIndex + 'Uncaught Error:'.length).trim()
  } else if (cleaned.startsWith('Error:')) {
    cleaned = cleaned.slice('Error:'.length).trim()
  } else {
    const errorIndex = cleaned.indexOf('Error:')
    if (errorIndex !== -1 && errorIndex < 60) {
      cleaned = cleaned.slice(errorIndex + 'Error:'.length).trim()
    }
  }

  const stackMatch = cleaned.match(/\sat\s.+\.(ts|tsx|js|jsx):\d/)
  if (stackMatch?.index !== undefined) {
    cleaned = cleaned.slice(0, stackMatch.index).trim()
  }

  const clientIndex = cleaned.indexOf('Called by client')
  if (clientIndex !== -1) {
    cleaned = cleaned.slice(0, clientIndex).trim()
  }

  return cleaned || message
}

const extractCode = (error: unknown) => {
  if (error && typeof error === 'object') {
    const maybeError = error as ErrorLike
    if (typeof maybeError.data?.code === 'string') {
      return maybeError.data.code
    }
    if (typeof maybeError.code === 'string') {
      return maybeError.code
    }
  }

  return ''
}

const mapMessageToCode = (message: string) => {
  const lower = message.toLowerCase()
  if (
    (lower.includes('soniox') ||
      lower.includes('deepgram') ||
      lower.includes('transcription')) &&
    lower.includes('missing')
  ) {
    return 'STT_CONFIG_MISSING'
  }
  if (lower.includes('tts') && lower.includes('missing')) {
    return 'TTS_CONFIG_MISSING'
  }
  if (lower.includes('stt') && lower.includes('connection')) {
    return 'STT_CONNECTION'
  }
  if (
    lower.includes('elevenlabs') ||
    lower.includes('text-to-speech') ||
    lower.includes('google cloud tts') ||
    lower.includes('vertex_gemini_tts')
  ) {
    return 'TTS_REQUEST_FAILED'
  }
  if (lower.includes('permission') && lower.includes('microphone')) {
    return 'MIC_PERMISSION'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'NETWORK'
  }
  if (
    lower.includes('invalid credentials') ||
    lower.includes('invalidcredential') ||
    lower.includes('invalidsecret') ||
    lower.includes('invalidaccountid') ||
    lower.includes('invalid account') ||
    lower.includes('invalid password')
  ) {
    return 'INVALID_CREDENTIALS'
  }
  if (
    lower.includes('jwt_private_key') ||
    lower.includes('jwt public key') ||
    (lower.includes('missing environment variable') && lower.includes('auth'))
  ) {
    return 'AUTH_CONFIG_MISSING'
  }
  if (
    lower.includes('unauthorized') ||
    lower.includes('not authorized') ||
    lower.includes('not authenticated') ||
    lower.includes('authentication required') ||
    lower.includes('please sign in')
  ) {
    return 'UNAUTHORIZED'
  }
  if (lower.includes('limit') && lower.includes('demo')) {
    return 'DEMO_LIMIT'
  }
  return 'UNKNOWN'
}

export const toAppError = (
  error: unknown,
  fallback: {
    message?: string
    source?: AppErrorSource
    code?: string
  } = {},
): AppError => {
  const rawMessage = sanitizeMessage(
    extractMessage(error) || fallback.message || 'Something went wrong.',
  )
  const inferredCode = mapMessageToCode(rawMessage)
  const extractedCode = extractCode(error) || fallback.code
  const code =
    inferredCode === 'INVALID_CREDENTIALS'
      ? inferredCode
      : extractedCode || inferredCode
  const message = codeMessageMap[code] ?? rawMessage

  const lower = message.toLowerCase()
  const retryable = !(
    lower.includes('missing') ||
    lower.includes('unauthorized') ||
    lower.includes('permission')
  )

  return {
    code,
    message,
    source: fallback.source ?? 'unknown',
    retryable,
    details: typeof error === 'string' ? error : undefined,
  }
}
