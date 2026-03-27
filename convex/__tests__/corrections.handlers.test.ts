// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/speech/corrections', () => ({
  buildCorrectionsPrompt: () => 'prompt',
  buildCorrectionsSystemPrompt: () => 'system',
  correctionsSchema: {},
  isCorrectionsResult: () => true,
  normalizeCorrections: (value: Array<unknown>) => value,
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
    corrections: {
      appendCorrections: 'corrections:appendCorrections',
    },
  },
}))

vi.mock('../_generated/server', () => ({
  action: (opts: any) => opts,
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

describe('createAnalyzeTurnHandler (corrections)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists corrections when cost recording fails', async () => {
    const { createAnalyzeTurnHandler } = await import('../corrections')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18,
      },
      value: {
        corrections: [
          {
            title: 'Agreement',
            detail: 'Use plural adjective form.',
            original: 'nuevo ideas',
            corrected: 'nuevas ideas',
            severity: 'medium',
            category: 'grammar',
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
      text: 'nuevo ideas',
      transcriptEventId: 'event_1' as any,
    })

    expect(result).toEqual({ inserted: 1 })
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'corrections:appendCorrections',
      expect.objectContaining({
        sessionId: 'session_1',
        transcriptEventId: 'event_1',
      }),
    )
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('returns inserted=0 for empty correction output even when cost recording fails', async () => {
    const { createAnalyzeTurnHandler } = await import('../corrections')
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    generateMock.mockResolvedValueOnce({
      model: 'x-ai/grok-4.1-fast',
      usage: {
        inputTokens: 9,
        outputTokens: 2,
        totalTokens: 11,
      },
      value: {
        corrections: [],
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
      text: 'texto correcto',
      transcriptEventId: 'event_2' as any,
    })

    expect(result).toEqual({ inserted: 0 })
    expect(ctx.runMutation).not.toHaveBeenCalled()
    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
