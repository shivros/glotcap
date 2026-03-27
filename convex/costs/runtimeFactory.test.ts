// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createNeutralCostRecorderMock = vi.fn()
const createStructuredOutputCostServiceMock = vi.fn()
const createToolUsageCostServiceMock = vi.fn()

vi.mock('./neutralCostRecorder', () => ({
  createNeutralCostRecorder: (...args: Array<unknown>) =>
    createNeutralCostRecorderMock(...args),
}))

vi.mock('./structuredOutputCostService', () => ({
  createStructuredOutputCostService: (...args: Array<unknown>) =>
    createStructuredOutputCostServiceMock(...args),
}))

vi.mock('./toolUsageCostService', () => ({
  createToolUsageCostService: (...args: Array<unknown>) =>
    createToolUsageCostServiceMock(...args),
}))

describe('createCostRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates default runtime using recorder and service factories', async () => {
    const recorder = { recordAICost: vi.fn(), recordToolCost: vi.fn() }
    const structured = { recordCompletionCost: vi.fn() }
    const tool = { recordLlmStreamCost: vi.fn() }

    createNeutralCostRecorderMock.mockReturnValueOnce(recorder)
    createStructuredOutputCostServiceMock.mockReturnValueOnce(structured)
    createToolUsageCostServiceMock.mockReturnValueOnce(tool)

    const module = await import('./runtimeFactory')
    const runtime = module.createCostRuntime()

    expect(createNeutralCostRecorderMock).toHaveBeenCalledTimes(1)
    expect(createStructuredOutputCostServiceMock).toHaveBeenCalledWith(recorder)
    expect(createToolUsageCostServiceMock).toHaveBeenCalledWith(recorder)
    expect(runtime).toEqual({
      recorder,
      structuredOutputCostService: structured,
      toolUsageCostService: tool,
    })
  })

  it('respects injected overrides', async () => {
    const recorder = { recordAICost: vi.fn(), recordToolCost: vi.fn() }
    const structured = { recordCompletionCost: vi.fn() }
    const tool = { recordLlmStreamCost: vi.fn() }

    const module = await import('./runtimeFactory')
    const runtime = module.createCostRuntime({
      recorder: recorder as any,
      structuredOutputCostService: structured as any,
      toolUsageCostService: tool as any,
    })

    expect(createNeutralCostRecorderMock).not.toHaveBeenCalled()
    expect(createStructuredOutputCostServiceMock).not.toHaveBeenCalled()
    expect(createToolUsageCostServiceMock).not.toHaveBeenCalled()
    expect(runtime).toEqual({
      recorder,
      structuredOutputCostService: structured,
      toolUsageCostService: tool,
    })
  })
})
