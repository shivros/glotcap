export type ElevenLabsVoice = {
  voiceId: string
  name: string
  category?: string
  previewUrl?: string
}

const parseVoices = (value: unknown): Array<ElevenLabsVoice> => {
  if (!value || typeof value !== 'object') {
    return []
  }
  const voices = (value as { voices?: unknown }).voices
  if (!Array.isArray(voices)) {
    return []
  }

  const parsed: Array<ElevenLabsVoice> = []
  for (const voice of voices) {
    if (!voice || typeof voice !== 'object') {
      continue
    }
    const row = voice as {
      voice_id?: unknown
      name?: unknown
      category?: unknown
      preview_url?: unknown
    }
    if (typeof row.voice_id !== 'string' || typeof row.name !== 'string') {
      continue
    }

    parsed.push({
      voiceId: row.voice_id,
      name: row.name,
      category: typeof row.category === 'string' ? row.category : undefined,
      previewUrl:
        typeof row.preview_url === 'string' ? row.preview_url : undefined,
    })
  }

  return parsed
}

export const requestElevenLabsVoices = async (args: { apiKey: string }) => {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': args.apiKey.trim(),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(
      `ElevenLabs voices request failed (${response.status}): ${details}`,
    )
  }

  const payload = (await response.json()) as unknown
  return parseVoices(payload)
}
