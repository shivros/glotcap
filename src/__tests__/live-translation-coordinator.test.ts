import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveTranslationCoordinator } from '@/lib/live-translation-coordinator'

const flushTasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('LiveTranslationCoordinator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes immediately when a sentence boundary is detected', async () => {
    const updates: Array<{ sourceId: string; text: string }> = []
    const translate = vi.fn((text: string) => Promise.resolve(`tr:${text}`))

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (sourceId, text) => {
        updates.push({ sourceId, text })
      },
      flushMs: 10_000,
    })

    coordinator.updateSource('teacher-1', 'Hello there.')
    await flushTasks()

    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenCalledWith(
      'Hello there.',
      expect.objectContaining({
        sourceId: 'teacher-1',
        reason: 'immediate',
      }),
    )
    expect(updates.at(-1)).toEqual({
      sourceId: 'teacher-1',
      text: 'tr:Hello there.',
    })
  })

  it('waits on tiny fragments but force-flushes after max wait', async () => {
    vi.useFakeTimers()
    const translate = vi.fn((text: string) => Promise.resolve(`tr:${text}`))
    const updates: Array<string> = []

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      flushMs: 50,
      maxWaitMs: 120,
      minChars: 8,
      minWords: 2,
    })

    coordinator.updateSource('teacher-2', 'hi')
    await vi.advanceTimersByTimeAsync(60)
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(130)
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenCalledWith(
      'hi',
      expect.objectContaining({
        sourceId: 'teacher-2',
        reason: 'force',
      }),
    )
    expect(updates.at(-1)).toBe('tr:hi')
  })

  it('translates only newly appended text for a growing source', async () => {
    vi.useFakeTimers()
    const translate = vi.fn((text: string) => Promise.resolve(`tr:${text}`))
    const updates: Array<string> = []

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      flushMs: 20,
      maxWaitMs: 1_000,
      minChars: 8,
      minWords: 2,
    })

    coordinator.updateSource('teacher-3', 'Hello world')
    await vi.advanceTimersByTimeAsync(25)
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenNthCalledWith(
      1,
      'Hello world',
      expect.objectContaining({
        sourceId: 'teacher-3',
        reason: 'timer',
      }),
    )
    expect(updates.at(-1)).toBe('tr:Hello world')

    coordinator.updateSource('teacher-3', 'Hello world again.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(2)
    expect(translate).toHaveBeenNthCalledWith(
      2,
      'again.',
      expect.objectContaining({
        sourceId: 'teacher-3',
        reason: 'immediate',
      }),
    )
    expect(updates.at(-1)).toBe('tr:Hello world tr:again.')
  })

  it('does not resend unchanged source text', async () => {
    vi.useFakeTimers()
    const translate = vi.fn((text: string) => Promise.resolve(`tr:${text}`))

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: () => {},
      flushMs: 20,
    })

    coordinator.updateSource('teacher-4', 'Good morning everyone.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)

    coordinator.updateSource('teacher-4', 'Good morning everyone.')
    await vi.advanceTimersByTimeAsync(100)
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)
  })

  it('appends streaming deltas without injecting artificial spaces', async () => {
    const updates: Array<string> = []
    const translate = vi.fn((text: string) => Promise.resolve(`tr:${text}`))

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      flushMs: 10_000,
    })

    coordinator.appendDelta('teacher-4b', 'Hel')
    coordinator.appendDelta('teacher-4b', 'lo there.')
    await flushTasks()

    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenCalledWith(
      'Hello there.',
      expect.objectContaining({
        sourceId: 'teacher-4b',
        reason: 'immediate',
      }),
    )
    expect(updates.at(-1)).toBe('tr:Hello there.')
  })

  it('coalesces pending updates while a translation request is in flight', async () => {
    const resolvers: Array<(value: string) => void> = []
    const updates: Array<string> = []

    const translate = vi.fn((_text: string) => {
      return new Promise<string>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      flushMs: 20,
      maxWaitMs: 200,
    })

    coordinator.updateSource('teacher-5', 'Hello there.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)
    expect(translate).toHaveBeenNthCalledWith(
      1,
      'Hello there.',
      expect.objectContaining({
        sourceId: 'teacher-5',
        reason: 'immediate',
      }),
    )

    coordinator.updateSource('teacher-5', 'Hello there. How are you doing')
    coordinator.updateSource('teacher-5', 'Hello there. How are you doing?')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)

    const first = resolvers.shift()
    expect(first).toBeDefined()
    first?.('tr:hello')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(2)
    expect(translate).toHaveBeenNthCalledWith(
      2,
      'How are you doing?',
      expect.objectContaining({
        sourceId: 'teacher-5',
        reason: 'immediate',
      }),
    )
    expect(updates.at(-1)).toBe('tr:hello')

    const second = resolvers.shift()
    expect(second).toBeDefined()
    second?.('tr:how are you')
    await flushTasks()
    expect(updates.at(-1)).toBe('tr:hello tr:how are you')
  })

  it('preempts a slow in-flight request when fresh pending text keeps arriving', async () => {
    const resolvers: Array<(value: string) => void> = []
    const updates: Array<string> = []
    const telemetryStages: Array<string> = []
    let now = 0

    const translate = vi.fn((_text: string) => {
      return new Promise<string>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      onTelemetry: (event) => {
        telemetryStages.push(event.stage)
      },
      now: () => now,
      preemptAfterMs: 500,
      preemptMinPendingChars: 12,
      flushMs: 10_000,
    })

    coordinator.updateSource('teacher-6', 'Hello there.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)

    now = 750
    coordinator.updateSource(
      'teacher-6',
      'Hello there. This is a fresh sentence.',
    )
    await flushTasks()

    expect(translate).toHaveBeenCalledTimes(2)
    expect(telemetryStages).toContain('request_preempted')

    const first = resolvers.shift()
    const second = resolvers.shift()
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    first?.('stale-result')
    await flushTasks()
    expect(updates).toEqual([])

    second?.('fresh-result')
    await flushTasks()
    expect(updates.at(-1)).toBe('fresh-result')
  })

  it('does not emit an empty update when in-flight output is invalidated by source rewrite', async () => {
    const resolvers: Array<(value: string) => void> = []
    const updates: Array<string> = []

    const translate = vi.fn((_text: string) => {
      return new Promise<string>((resolve) => {
        resolvers.push(resolve)
      })
    })

    const coordinator = new LiveTranslationCoordinator({
      translate,
      onUpdate: (_sourceId, text) => {
        updates.push(text)
      },
      flushMs: 10_000,
    })

    coordinator.updateSource('teacher-7', 'Hello there.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(1)

    const first = resolvers.shift()
    expect(first).toBeDefined()
    first?.('tr:hello')
    await flushTasks()
    expect(updates.at(-1)).toBe('tr:hello')

    coordinator.updateSource('teacher-7', 'Hello there. More text.')
    await flushTasks()
    expect(translate).toHaveBeenCalledTimes(2)

    coordinator.updateSource('teacher-7', 'Hello there More text.')
    await flushTasks()

    const second = resolvers.shift()
    expect(second).toBeDefined()
    second?.('tr:more')
    await flushTasks()

    expect(updates).not.toContain('')
    expect(updates.at(-1)).toBe('tr:hello')
  })
})
