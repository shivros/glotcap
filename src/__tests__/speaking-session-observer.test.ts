import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeakingSessionObserver } from '@/lib/speaking-session-observer'

describe('createSpeakingSessionObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'))
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('logs known voice events with merged context and details when enabled', () => {
    const observer = createSpeakingSessionObserver({
      enabled: true,
      getContext: () => ({
        sessionId: 'session-1',
        conversationMode: 'coach',
      }),
    })

    observer.emit({
      name: 'turn_scheduled',
      at: 1_700_000_000_000,
      details: { trigger: 'final_transcript' },
    })

    expect(console.debug).toHaveBeenCalledWith(
      '[glotcap.voice]',
      'turn_scheduled',
      expect.objectContaining({
        at: new Date(1_700_000_000_000).toISOString(),
        sessionId: 'session-1',
        conversationMode: 'coach',
        trigger: 'final_transcript',
      }),
    )
  })

  it('dedupes stale_callback_dropped events within the dedupe window', () => {
    const observer = createSpeakingSessionObserver({ enabled: true })

    observer.emit({
      name: 'stale_callback_dropped',
      details: { reason: 'stop_requested', phase: 'send_result' },
    })
    observer.emit({
      name: 'stale_callback_dropped',
      details: { reason: 'stop_requested', phase: 'send_result' },
    })

    expect(console.debug).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(751)
    observer.emit({
      name: 'stale_callback_dropped',
      details: { reason: 'stop_requested', phase: 'send_result' },
    })
    expect(console.debug).toHaveBeenCalledTimes(2)
  })

  it('uses event timestamps for stale dedupe when event.at is provided', () => {
    const observer = createSpeakingSessionObserver({ enabled: true })

    observer.emit({
      name: 'stale_callback_dropped',
      at: 1_700_000_000_000,
      details: { reason: 'stop_requested', phase: 'send_result' },
    })
    observer.emit({
      name: 'stale_callback_dropped',
      at: 1_700_000_000_999,
      details: { reason: 'stop_requested', phase: 'send_result' },
    })

    expect(console.debug).toHaveBeenCalledTimes(2)
  })

  it('respects environment debug override when enabled flag is omitted', () => {
    vi.stubEnv('VITE_GLOTCAP_VOICE_DEBUG', 'false')
    const disabledObserver = createSpeakingSessionObserver()
    disabledObserver.emit({ name: 'turn_scheduled' })
    expect(console.debug).not.toHaveBeenCalled()

    vi.stubEnv('VITE_GLOTCAP_VOICE_DEBUG', 'true')
    const enabledObserver = createSpeakingSessionObserver()
    enabledObserver.emit({ name: 'turn_scheduled' })
    expect(console.debug).toHaveBeenCalledTimes(1)
  })
})
