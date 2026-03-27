import { describe, expect, it, vi } from 'vitest'
import { dispatchLearnerInsights } from '@/lib/speaking-session-learner-insights'

const request = {
  sessionId: 'session_1' as any,
  text: 'hola mundo',
  transcriptEventId: 'event_1' as any,
}

describe('dispatchLearnerInsights', () => {
  it('dispatches corrections and vocabulary for the same learner transcript', () => {
    const requestCorrections = vi.fn()
    const requestVocabulary = vi.fn()
    const emitLatencyTelemetry = vi.fn()
    const serializeError = vi.fn((error: unknown) => String(error))

    dispatchLearnerInsights({
      request,
      requestCorrections,
      requestVocabulary,
      emitLatencyTelemetry,
      serializeError,
    })

    expect(requestCorrections).toHaveBeenCalledWith(request)
    expect(requestVocabulary).toHaveBeenCalledWith(request)
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_done',
      expect.objectContaining({
        analyzer: 'corrections',
      }),
    )
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_done',
      expect.objectContaining({
        analyzer: 'vocabulary',
      }),
    )
  })

  it('continues to vocabulary dispatch when corrections dispatch throws', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const requestCorrections = vi.fn(() => {
      throw new Error('corrections boom')
    })
    const requestVocabulary = vi.fn()
    const emitLatencyTelemetry = vi.fn()
    const serializeError = vi.fn((error: unknown) => String(error))

    dispatchLearnerInsights({
      request,
      requestCorrections,
      requestVocabulary,
      emitLatencyTelemetry,
      serializeError,
    })

    expect(requestVocabulary).toHaveBeenCalledWith(request)
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_failed',
      expect.objectContaining({
        analyzer: 'corrections',
      }),
    )
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_done',
      expect.objectContaining({
        analyzer: 'vocabulary',
      }),
    )
    consoleError.mockRestore()
  })

  it('still completes corrections telemetry when vocabulary dispatch throws', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const requestCorrections = vi.fn()
    const requestVocabulary = vi.fn(() => {
      throw new Error('vocabulary boom')
    })
    const emitLatencyTelemetry = vi.fn()
    const serializeError = vi.fn((error: unknown) => String(error))

    dispatchLearnerInsights({
      request,
      requestCorrections,
      requestVocabulary,
      emitLatencyTelemetry,
      serializeError,
    })

    expect(requestCorrections).toHaveBeenCalledWith(request)
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_done',
      expect.objectContaining({
        analyzer: 'corrections',
      }),
    )
    expect(emitLatencyTelemetry).toHaveBeenCalledWith(
      'transcript_flush_failed',
      expect.objectContaining({
        analyzer: 'vocabulary',
      }),
    )
    consoleError.mockRestore()
  })
})
