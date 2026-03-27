// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  createStructuredOutputCostService,
  recordStructuredOutputCostBestEffort,
} from './structuredOutputCostService'

describe('StructuredOutputCostService', () => {
  it('maps structured output usage into AI cost recording', async () => {
    const recordAICost = vi.fn(
      async (_ctx: unknown, _payload: Record<string, unknown>) => {},
    )
    const service = createStructuredOutputCostService({
      recordAICost,
      recordToolCost: vi.fn(async () => {}),
    })

    const ctx = {} as any
    await service.recordCompletionCost(ctx, {
      operation: 'speaking-corrections',
      modelId: 'openrouter/auto',
      threadId: 'speaking:session_1',
      userId: 'user_1',
      usage: {
        inputTokens: 11,
        outputTokens: 9,
        totalTokens: 20,
      },
    })

    expect(recordAICost).toHaveBeenCalledTimes(1)
    const [calledCtx, payload] = recordAICost.mock.calls[0]
    expect(calledCtx).toBe(ctx)
    expect(payload).toEqual(
      expect.objectContaining({
        userId: 'user_1',
        threadId: 'speaking:session_1',
        providerId: 'openrouter',
        modelId: 'openrouter/auto',
        usage: { promptTokens: 11, completionTokens: 9, totalTokens: 20 },
      }),
    )
    expect((payload as { messageId?: string }).messageId).toMatch(
      /^speaking-corrections:speaking:session_1:/,
    )
  })

  it('records structured output cost best-effort on success without logging', async () => {
    const recordCompletionCost = vi.fn(() => Promise.resolve())
    const service = {
      recordCompletionCost,
    } as any
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await recordStructuredOutputCostBestEffort(service, {} as any, {
      operation: 'speaking-vocabulary',
      modelId: 'openrouter/auto',
      threadId: 'speaking:session_2',
      usage: {
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      },
    })

    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('swallows structured output cost recording errors and logs context', async () => {
    const recordCompletionCost = vi.fn(() =>
      Promise.reject(new Error('Pricing not found for model')),
    )
    const service = {
      recordCompletionCost,
    } as any
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await recordStructuredOutputCostBestEffort(service, {} as any, {
      operation: 'speaking-vocabulary',
      modelId: 'openrouter/auto',
      threadId: 'speaking:session_3',
      usage: {
        inputTokens: 4,
        outputTokens: 1,
        totalTokens: 5,
      },
    })

    expect(recordCompletionCost).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to record structured output cost',
      expect.objectContaining({
        operation: 'speaking-vocabulary',
        modelId: 'openrouter/auto',
        threadId: 'speaking:session_3',
      }),
    )
    consoleError.mockRestore()
  })
})
