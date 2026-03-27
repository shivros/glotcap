import type { TtsProviderName } from './types'

export type TtsErrorCode =
  | 'TTS_CONFIG_MISSING'
  | 'TTS_PROVIDER_MISSING'
  | 'TTS_PROVIDER_UNAVAILABLE'
  | 'TTS_PROVIDER_UNSUPPORTED'
  | 'TTS_REQUEST_FAILED'

export class TtsError extends Error {
  code: TtsErrorCode
  provider?: TtsProviderName

  constructor(args: {
    code: TtsErrorCode
    message: string
    provider?: TtsProviderName
    cause?: unknown
  }) {
    super(args.message)
    this.name = 'TtsError'
    this.code = args.code
    this.provider = args.provider
    if (args.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = args.cause
    }
  }
}

export const isTtsError = (value: unknown): value is TtsError =>
  value instanceof TtsError
