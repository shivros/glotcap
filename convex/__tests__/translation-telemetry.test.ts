import { describe, expect, it, vi } from 'vitest'
import { ConvexTranslationTelemetrySink } from '../translation_telemetry'
import type { TranslationAttempt } from '../translation_service'

const buildAttempt = (
  overrides: Partial<TranslationAttempt> = {},
): TranslationAttempt => ({
  status: 'ok',
  text: 'translated text',
  model: 'test-model',
  timings: {
    ttftMs: 123,
    totalMs: 456,
    chunkCount: 3,
  },
  ...overrides,
})

describe('ConvexTranslationTelemetrySink', () => {
  it('does not block the caller when writing telemetry', async () => {
    vi.useFakeTimers()
    let settled = false
    const writeEvent = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250))
      settled = true
    })

    const sink = new ConvexTranslationTelemetrySink(writeEvent)

    const result = sink.recordProviderTiming({
      request: {
        text: 'hola',
        targetLanguage: 'English',
        sourceLanguage: 'Spanish',
      },
      attempt: buildAttempt(),
      context: {
        sessionId: 'session-1',
        sourceId: 'source-1',
        reason: 'timer',
        revision: 1,
      },
    })

    expect(result).toBeUndefined()
    expect(writeEvent).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(300)
    expect(settled).toBe(true)
    vi.useRealTimers()
  })

  it('swallows sink write failures and reports to console', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const sink = new ConvexTranslationTelemetrySink(() =>
      Promise.reject(new Error('log failed')),
    )

    expect(() =>
      sink.recordProviderTiming({
        request: {
          text: 'hola',
          targetLanguage: 'English',
        },
        attempt: buildAttempt({ status: 'error', error: new Error('boom') }),
        context: {},
      }),
    ).not.toThrow()

    await Promise.resolve()
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
