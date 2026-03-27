/**
 * Fetch with Timeout
 *
 * A wrapper around fetch that adds timeout support via AbortController.
 * Throws a TimeoutError if the request takes longer than the specified timeout.
 */

/**
 * Custom error for timeout scenarios
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Options for fetchWithTimeout
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number
}

/**
 * Fetch with automatic timeout handling
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus optional timeoutMs
 * @returns The fetch Response
 * @throws TimeoutError if the request times out
 *
 * @example
 * try {
 *   const response = await fetchWithTimeout('https://api.example.com/data', {
 *     timeoutMs: 5000,
 *     method: 'GET',
 *   })
 *   const data = await response.json()
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.log(`Request timed out after ${error.timeoutMs}ms`)
 *   }
 * }
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = 30000, signal: externalSignal, ...fetchOptions } = options

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // If an external signal is provided, forward its abort
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort())
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    // Check if this was a timeout abort
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(
        `Request to ${url} timed out after ${timeoutMs}ms`,
        timeoutMs,
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch JSON with timeout
 *
 * Convenience wrapper that fetches and parses JSON in one call.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus optional timeoutMs
 * @returns The parsed JSON response
 * @throws TimeoutError if the request times out
 * @throws Error if the response is not ok or JSON parsing fails
 *
 * @example
 * const data = await fetchJson<{ id: string }>('https://api.example.com/data', {
 *   timeoutMs: 5000,
 * })
 */
export async function fetchJson<T = unknown>(
  url: string | URL,
  options: FetchWithTimeoutOptions = {},
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
  }

  return response.json() as Promise<T>
}
