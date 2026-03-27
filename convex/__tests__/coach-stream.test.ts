// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const streamMock = vi.hoisted(() => vi.fn())
const fetchCoachHistoryMock = vi.hoisted(() => vi.fn())
const buildCoachSystemPromptMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/llm', () => ({
  createLlmClient: () => ({
    stream: (...args: Array<unknown>) => streamMock(...args),
  }),
}))

vi.mock('../_generated/api', () => ({
  internal: {
    speaking: {
      updateStreamEvent: 'internal.speaking.updateStreamEvent',
    },
    vocabulary: {
      analyzeCoachTurn: 'internal.vocabulary.analyzeCoachTurn',
    },
  },
}))

vi.mock('../costs', () => ({
  createCostRuntime: () => ({
    toolUsageCostService: {
      recordLlmStreamCost: vi.fn(async () => {}),
    },
  }),
}))

vi.mock('../coach/config', () => ({
  DEFAULT_COACH_TEMPERATURE: 0.2,
  MAX_COACH_HISTORY_MESSAGES: 20,
  requireEnv: (name: string) =>
    name === 'OPENROUTER_COACH_MODEL' ? 'openrouter/auto' : 'test-key',
}))

vi.mock('../coach/history', () => ({
  fetchCoachHistory: (...args: Array<unknown>) =>
    fetchCoachHistoryMock(...args),
}))

vi.mock('../coach/prompt', () => ({
  buildCoachSystemPrompt: (...args: Array<unknown>) =>
    buildCoachSystemPromptMock(...args),
}))

describe('runCoachStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not flip a successful stream to error when success-path cost recording fails', async () => {
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      yield 'hello'
      yield ' world'
    })
    fetchCoachHistoryMock.mockResolvedValueOnce([
      { role: 'user', content: 'prior input' },
    ])
    buildCoachSystemPromptMock.mockReturnValueOnce('coach-system-prompt')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { runCoachStream } = await import('../coach/stream')

    const ctx = {
      runMutation: vi.fn(() => Promise.resolve(null)),
      runAction: vi.fn(() => Promise.resolve(null)),
    } as any
    const append = vi.fn(() => Promise.resolve(undefined))
    const recordLlmStreamCost = vi.fn(() =>
      Promise.reject(new Error('cost service down')),
    )

    await expect(
      runCoachStream(
        {
          ctx,
          sessionId: 'session_1' as any,
          eventId: 'event_1' as any,
          streamId: 'stream_1',
          targetLanguage: 'en',
          append,
          userId: 'user_1' as any,
        },
        {
          toolUsageCostService: { recordLlmStreamCost } as any,
        },
      ),
    ).resolves.toBeUndefined()

    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.speaking.updateStreamEvent',
      expect.objectContaining({
        eventId: 'event_1',
        text: 'hello world',
        streamStatus: 'done',
      }),
    )
    expect(ctx.runMutation).not.toHaveBeenCalledWith(
      'internal.speaking.updateStreamEvent',
      expect.objectContaining({
        streamStatus: 'error',
      }),
    )
    expect(ctx.runAction).toHaveBeenCalledWith(
      'internal.vocabulary.analyzeCoachTurn',
      expect.objectContaining({
        eventId: 'event_1',
      }),
    )
    expect(append).toHaveBeenCalledTimes(2)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record coach streaming cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('logs vocabulary analysis failures but keeps successful stream state', async () => {
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      yield 'hola'
    })
    fetchCoachHistoryMock.mockResolvedValueOnce([])
    buildCoachSystemPromptMock.mockReturnValueOnce('coach-system-prompt')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { runCoachStream } = await import('../coach/stream')

    const ctx = {
      runMutation: vi.fn(() => Promise.resolve(null)),
      runAction: vi.fn(() => Promise.reject(new Error('analyze failed'))),
    } as any
    const append = vi.fn(() => Promise.resolve(undefined))
    const recordLlmStreamCost = vi.fn(() => Promise.resolve(undefined))

    await expect(
      runCoachStream(
        {
          ctx,
          sessionId: 'session_2' as any,
          eventId: 'event_2' as any,
          streamId: 'stream_2',
          targetLanguage: 'en',
          append,
        },
        {
          toolUsageCostService: { recordLlmStreamCost } as any,
        },
      ),
    ).resolves.toBeUndefined()

    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.speaking.updateStreamEvent',
      expect.objectContaining({
        eventId: 'event_2',
        text: 'hola',
        streamStatus: 'done',
      }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Vocabulary analysis failed',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it('marks stream as error and rethrows when streaming fails', async () => {
    streamMock.mockImplementation(() => {
      return {
        [Symbol.asyncIterator]() {
          return this
        },
        async next() {
          await Promise.resolve()
          throw new Error('stream provider failure')
        },
      }
    })
    fetchCoachHistoryMock.mockResolvedValueOnce([
      { role: 'user', content: 'prior input' },
    ])
    buildCoachSystemPromptMock.mockReturnValueOnce('coach-system-prompt')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { runCoachStream } = await import('../coach/stream')

    const ctx = {
      runMutation: vi.fn(() => Promise.resolve(null)),
      runAction: vi.fn(() => Promise.resolve(null)),
    } as any
    const append = vi.fn(() => Promise.resolve(undefined))
    const recordLlmStreamCost = vi.fn(() =>
      Promise.reject(new Error('cost service down')),
    )

    await expect(
      runCoachStream(
        {
          ctx,
          sessionId: 'session_3' as any,
          eventId: 'event_3' as any,
          streamId: 'stream_3',
          targetLanguage: 'en',
          append,
          userId: 'user_3' as any,
        },
        {
          toolUsageCostService: { recordLlmStreamCost } as any,
        },
      ),
    ).rejects.toThrow('stream provider failure')

    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.speaking.updateStreamEvent',
      expect.objectContaining({
        eventId: 'event_3',
        streamStatus: 'error',
      }),
    )
    expect(recordLlmStreamCost).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        metadata: expect.objectContaining({
          status: 'error',
        }),
      }),
    )
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record coach streaming cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })
})
