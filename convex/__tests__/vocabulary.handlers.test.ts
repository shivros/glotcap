// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/speech/vocabulary', () => ({
  buildVocabularyPrompt: () => 'prompt',
  buildVocabularySystemPrompt: () => 'system',
  isVocabularyResult: () => true,
  normalizeVocabulary: (value: Array<unknown>) => value,
  vocabularySchema: {},
}))

vi.mock('ts-common/structured-output', () => ({
  createStructuredOutputClient: () => ({
    generate: generateMock,
  }),
}))

vi.mock('../_generated/api', () => ({
  api: {
    speaking: {
      getSession: 'speaking:getSession',
    },
  },
  internal: {
    speaking: {
      getEventById: 'speaking:getEventById',
      getUserTranscriptByTurn: 'speaking:getUserTranscriptByTurn',
    },
    vocabulary: {
      appendVocabulary: 'vocabulary:appendVocabulary',
    },
  },
}))

vi.mock('../_generated/server', () => ({
  action: (opts: any) => opts,
  internalAction: (opts: any) => opts,
  internalMutation: (opts: any) => opts,
}))

vi.mock('../coach/config', () => ({
  requireEnv: () => 'test-env',
}))

vi.mock('../costs', () => ({
  createCostRuntime: () => ({
    structuredOutputCostService: {
      recordCompletionCost: vi.fn(() => Promise.resolve()),
    },
  }),
}))

describe('vocabulary handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists learner vocabulary when cost recording fails', async () => {
    const { createAnalyzeTurnHandler } = await import('../vocabulary')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
      },
      value: {
        vocabulary: [
          {
            word: 'aprovechar',
            definition: 'to take advantage of',
          },
        ],
      },
    })

    const ctx = {
      runQuery: vi.fn(() =>
        Promise.resolve({
          userId: 'user_1',
          targetLanguage: 'Spanish',
          sourceLanguage: 'English',
        }),
      ),
      runMutation: vi.fn(() => Promise.resolve({ inserted: 1 })),
    } as any

    const handler = createAnalyzeTurnHandler({
      structuredOutputCostService: {
        recordCompletionCost,
      } as any,
    })

    const result = await handler(ctx, {
      sessionId: 'session_1' as any,
      text: 'Quiero aprovechar esta oportunidad',
      transcriptEventId: 'event_1' as any,
      excludeText: '',
    })

    expect(result).toEqual({ inserted: 1 })
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'vocabulary:appendVocabulary',
      expect.objectContaining({
        sessionId: 'session_1',
        transcriptEventId: 'event_1',
      }),
    )
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('returns inserted=0 when learner vocabulary is excluded and cost recording fails', async () => {
    const { createAnalyzeTurnHandler } = await import('../vocabulary')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 6,
        outputTokens: 4,
        totalTokens: 10,
      },
      value: {
        vocabulary: [
          {
            word: 'hola',
            definition: 'hello',
          },
        ],
      },
    })

    const ctx = {
      runQuery: vi.fn(() =>
        Promise.resolve({
          userId: 'user_1',
          targetLanguage: 'Spanish',
          sourceLanguage: 'English',
        }),
      ),
      runMutation: vi.fn(() => Promise.resolve({ inserted: 1 })),
    } as any

    const handler = createAnalyzeTurnHandler({
      structuredOutputCostService: {
        recordCompletionCost,
      } as any,
    })

    const result = await handler(ctx, {
      sessionId: 'session_2' as any,
      text: 'hola',
      transcriptEventId: 'event_2' as any,
      excludeText: 'hola',
    })

    expect(result).toEqual({ inserted: 0 })
    expect(ctx.runMutation).not.toHaveBeenCalled()
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('persists coach vocabulary when cost recording fails', async () => {
    const { createAnalyzeCoachTurnHandler } = await import('../vocabulary')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 12,
        outputTokens: 5,
        totalTokens: 17,
      },
      value: {
        vocabulary: [
          {
            word: 'enfoque',
            definition: 'approach',
          },
        ],
      },
    })

    const ctx = {
      runQuery: vi.fn().mockImplementation((ref: string) => {
        if (ref === 'speaking:getEventById') {
          return Promise.resolve({
            _id: 'event_1',
            sessionId: 'session_1',
            type: 'transcript',
            speaker: 'coach',
            text: 'Necesitamos un nuevo enfoque para este problema.',
            turnId: 'turn_1',
          })
        }
        if (ref === 'speaking:getSession') {
          return Promise.resolve({
            userId: 'user_1',
            targetLanguage: 'Spanish',
            sourceLanguage: 'English',
          })
        }
        if (ref === 'speaking:getUserTranscriptByTurn') {
          return Promise.resolve({
            text: '',
          })
        }
        return Promise.resolve(null)
      }),
      runMutation: vi.fn(() => Promise.resolve({ inserted: 1 })),
    } as any

    const handler = createAnalyzeCoachTurnHandler({
      structuredOutputCostService: {
        recordCompletionCost,
      } as any,
    })

    const result = await handler(ctx, {
      eventId: 'event_1' as any,
    })

    expect(result).toEqual({ inserted: 1 })
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'vocabulary:appendVocabulary',
      expect.objectContaining({
        sessionId: 'session_1',
        transcriptEventId: 'event_1',
      }),
    )
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('returns inserted=0 when coach vocabulary is excluded and cost recording fails', async () => {
    const { createAnalyzeCoachTurnHandler } = await import('../vocabulary')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 7,
        outputTokens: 3,
        totalTokens: 10,
      },
      value: {
        vocabulary: [
          {
            word: 'enfoque',
            definition: 'approach',
          },
        ],
      },
    })

    const ctx = {
      runQuery: vi.fn().mockImplementation((ref: string) => {
        if (ref === 'speaking:getEventById') {
          return Promise.resolve({
            _id: 'event_3',
            sessionId: 'session_3',
            type: 'transcript',
            speaker: 'coach',
            text: 'Necesitamos un enfoque distinto.',
            turnId: 'turn_3',
          })
        }
        if (ref === 'speaking:getSession') {
          return Promise.resolve({
            userId: 'user_1',
            targetLanguage: 'Spanish',
            sourceLanguage: 'English',
          })
        }
        if (ref === 'speaking:getUserTranscriptByTurn') {
          return Promise.resolve({
            text: 'enfoque',
          })
        }
        return Promise.resolve(null)
      }),
      runMutation: vi.fn(() => Promise.resolve({ inserted: 1 })),
    } as any

    const handler = createAnalyzeCoachTurnHandler({
      structuredOutputCostService: {
        recordCompletionCost,
      } as any,
    })

    const result = await handler(ctx, {
      eventId: 'event_3' as any,
    })

    expect(result).toEqual({ inserted: 0 })
    expect(ctx.runMutation).not.toHaveBeenCalled()
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
