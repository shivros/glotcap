import type { TtsRequest, TtsResponse, TtsStreamResponse } from './types'

type ElevenLabsRequest = Omit<TtsRequest, 'voiceId' | 'modelId'> & {
  voiceId: string
  modelId?: string
  apiKey: string
  optimizeStreamingLatency?: number
  enableLogging?: boolean
}

const resolveMimeType = (outputFormat?: string) => {
  if (!outputFormat) {
    return 'audio/mpeg'
  }
  const lower = outputFormat.toLowerCase()
  if (lower.startsWith('mp3')) {
    return 'audio/mpeg'
  }
  if (lower.startsWith('wav')) {
    return 'audio/wav'
  }
  if (lower.includes('pcm')) {
    return 'audio/pcm'
  }
  return 'audio/mpeg'
}

export const requestElevenLabsSpeech = async (
  request: ElevenLabsRequest,
): Promise<TtsResponse> => {
  const outputFormat = request.outputFormat ?? 'mp3_44100_128'
  const params = new URLSearchParams({ output_format: outputFormat })

  if (typeof request.optimizeStreamingLatency === 'number') {
    params.set(
      'optimize_streaming_latency',
      request.optimizeStreamingLatency.toString(),
    )
  }
  if (typeof request.enableLogging === 'boolean') {
    params.set('enable_logging', String(request.enableLogging))
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': request.apiKey,
        'Content-Type': 'application/json',
        Accept: resolveMimeType(outputFormat),
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.modelId,
        language_code: request.languageCode,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `ElevenLabs TTS request failed (${response.status}): ${errorText}`,
    )
  }

  const buffer = await response.arrayBuffer()
  return {
    audio: new Uint8Array(buffer),
    mimeType: resolveMimeType(outputFormat),
  }
}

export const requestElevenLabsSpeechStream = async (
  request: ElevenLabsRequest,
): Promise<TtsStreamResponse> => {
  const outputFormat = request.outputFormat ?? 'mp3_44100_128'
  const params = new URLSearchParams({ output_format: outputFormat })

  if (typeof request.optimizeStreamingLatency === 'number') {
    params.set(
      'optimize_streaming_latency',
      request.optimizeStreamingLatency.toString(),
    )
  }
  if (typeof request.enableLogging === 'boolean') {
    params.set('enable_logging', String(request.enableLogging))
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}/stream?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': request.apiKey,
        'Content-Type': 'application/json',
        Accept: resolveMimeType(outputFormat),
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.modelId,
        language_code: request.languageCode,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `ElevenLabs TTS stream failed (${response.status}): ${errorText}`,
    )
  }

  if (!response.body) {
    throw new Error('ElevenLabs TTS stream missing response body.')
  }

  return {
    stream: response.body,
    mimeType: resolveMimeType(outputFormat),
  }
}
