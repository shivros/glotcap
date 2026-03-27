export type TtsStreamResult = {
  stream: ReadableStream<Uint8Array>
  mimeType: string
  cancel: () => void
}

export const requestTtsStream = async (
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<TtsStreamResult> => {
  const controller = new AbortController()

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        once: true,
      })
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'TTS streaming failed.')
  }

  if (!response.body) {
    throw new Error('TTS streaming response missing audio body.')
  }

  return {
    stream: response.body,
    mimeType: response.headers.get('Content-Type') ?? 'audio/mpeg',
    cancel: () => controller.abort(),
  }
}
