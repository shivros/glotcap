'use node'

import { ConvexError } from 'convex/values'
import type { SubtitleSegment } from '../../mediaToolsDomain'
import type { ITranscriptionProvider } from '../application/interfaces'

const resolveTranscriptionConfig = () => {
  const apiBase = process.env.WHISPER_API_BASE ?? 'https://api.openai.com/v1'
  const apiKey =
    process.env.WHISPER_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY
  const model = process.env.WHISPER_MODEL ?? 'whisper-1'

  if (!apiKey) {
    throw new ConvexError({
      code: 'MISSING_CONFIG',
      message:
        'Missing transcription API key. Set WHISPER_API_KEY or OPENAI_API_KEY.',
    })
  }

  return {
    apiBase: apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase,
    apiKey,
    model,
  }
}

const coerceOpenAiSegments = (
  raw: unknown,
  fallbackText: string,
): Array<SubtitleSegment> => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      {
        segmentIndex: 1,
        originalText: fallbackText.trim(),
      },
    ]
  }

  const segments = raw
    .map((segment, index) => {
      if (!segment || typeof segment !== 'object') {
        return null
      }
      const maybeText = (segment as { text?: unknown }).text
      const maybeStart = (segment as { start?: unknown }).start
      const maybeEnd = (segment as { end?: unknown }).end
      const text =
        typeof maybeText === 'string'
          ? maybeText.trim()
          : String(maybeText ?? '')
      if (!text) {
        return null
      }
      return {
        segmentIndex: index + 1,
        startMs:
          typeof maybeStart === 'number'
            ? Math.max(0, Math.floor(maybeStart * 1000))
            : undefined,
        endMs:
          typeof maybeEnd === 'number'
            ? Math.max(0, Math.floor(maybeEnd * 1000))
            : undefined,
        originalText: text,
      }
    })
    .filter((segment) => segment !== null)

  if (segments.length === 0) {
    return [
      {
        segmentIndex: 1,
        originalText: fallbackText.trim(),
      },
    ]
  }

  return segments
}

export class OpenAiTranscriptionProvider implements ITranscriptionProvider {
  async transcribe(args: {
    blob: Blob
    fileName: string
    sourceLanguage?: string
  }) {
    const config = resolveTranscriptionConfig()
    const formData = new FormData()
    formData.set('file', args.blob, args.fileName)
    formData.set('model', config.model)
    formData.set('response_format', 'verbose_json')
    if (args.sourceLanguage?.trim()) {
      formData.set('language', args.sourceLanguage.trim())
    }

    const response = await fetch(`${config.apiBase}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new ConvexError({
        code: 'TRANSCRIPTION_FAILED',
        message: `Transcription request failed (${response.status}): ${detail.slice(0, 300)}`,
      })
    }

    const payload = (await response.json()) as {
      text?: unknown
      segments?: unknown
    }

    const transcript =
      typeof payload.text === 'string'
        ? payload.text.trim()
        : String(payload.text ?? '')

    if (!transcript) {
      throw new ConvexError({
        code: 'TRANSCRIPTION_FAILED',
        message: 'Transcription provider returned an empty transcript.',
      })
    }

    return {
      transcript,
      segments: coerceOpenAiSegments(payload.segments, transcript),
    }
  }
}
