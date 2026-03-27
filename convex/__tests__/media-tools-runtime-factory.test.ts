// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCostRuntimeMock = vi.fn()
const openAiCtorMock = vi.fn()
const translationCtorMock = vi.fn()
const trackingTranscriptionCtorMock = vi.fn()
const trackingTranslationCtorMock = vi.fn()

vi.mock('../costs', () => ({
  createCostRuntime: (...args: Array<unknown>) =>
    createCostRuntimeMock(...args),
}))

vi.mock('../mediaTools/infrastructure/openAiTranscriptionProvider', () => ({
  OpenAiTranscriptionProvider: class {
    constructor(...args: Array<unknown>) {
      openAiCtorMock(...args)
    }
  },
}))

vi.mock('../mediaTools/infrastructure/translationProviderAdapter', () => ({
  ConvexTranslationProviderAdapter: class {
    constructor(...args: Array<unknown>) {
      translationCtorMock(...args)
    }
  },
}))

vi.mock(
  '../mediaTools/infrastructure/costTrackingTranscriptionProvider',
  () => ({
    CostTrackingTranscriptionProvider: class {
      constructor(...args: Array<unknown>) {
        trackingTranscriptionCtorMock(...args)
        return { kind: 'tracked-transcription' }
      }
    },
  }),
)

vi.mock('../mediaTools/infrastructure/costTrackingTranslationProvider', () => ({
  CostTrackingTranslationProvider: class {
    constructor(...args: Array<unknown>) {
      trackingTranslationCtorMock(...args)
      return { kind: 'tracked-translation' }
    }
  },
}))

describe('createMediaToolsProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.WHISPER_MODEL
    delete process.env.LLM_PROVIDER
    delete process.env.OPENROUTER_TRANSLATION_MODEL
    delete process.env.OPENROUTER_COACH_MODEL
  })

  it('builds tracked providers from default base providers', async () => {
    const toolUsageCostService = { recordLlmStreamCost: vi.fn() }
    createCostRuntimeMock.mockReturnValueOnce({
      recorder: {},
      structuredOutputCostService: {},
      toolUsageCostService,
    })

    const { createMediaToolsProviders } =
      await import('../mediaTools/infrastructure/runtimeFactory')

    const result = createMediaToolsProviders({
      ctx: {} as any,
      threadId: 'media-tools:job_1',
    })

    expect(openAiCtorMock).toHaveBeenCalledTimes(1)
    expect(translationCtorMock).toHaveBeenCalledTimes(1)
    expect(trackingTranscriptionCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'media-tools:job_1',
        toolUsageCostService,
      }),
    )
    expect(trackingTranslationCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'media-tools:job_1',
        toolUsageCostService,
      }),
    )

    const transcriptionArgs = trackingTranscriptionCtorMock.mock.calls[0]?.[0]
    const translationArgs = trackingTranslationCtorMock.mock.calls[0]?.[0]
    expect(transcriptionArgs.modelIdResolver()).toBe('whisper-1')
    expect(translationArgs.providerNameResolver()).toBeUndefined()
    expect(translationArgs.modelIdResolver()).toBe('openrouter/auto')

    expect(result.transcriptionProvider).toEqual({
      kind: 'tracked-transcription',
    })
    expect(result.translationProvider).toEqual({ kind: 'tracked-translation' })
  })

  it('uses injected base providers and cost runtime overrides', async () => {
    const toolUsageCostService = { recordLlmStreamCost: vi.fn() }
    createCostRuntimeMock.mockReturnValueOnce({
      recorder: {},
      structuredOutputCostService: {},
      toolUsageCostService,
    })

    const { createMediaToolsProviders } =
      await import('../mediaTools/infrastructure/runtimeFactory')

    const baseTranscription = { transcribe: vi.fn() }
    const baseTranslation = { translateSegment: vi.fn() }

    createMediaToolsProviders({
      ctx: {} as any,
      threadId: 'media-tools:job_2',
      costRuntime: { toolUsageCostService } as any,
      transcriptionProvider: baseTranscription as any,
      translationProvider: baseTranslation as any,
    })

    expect(createCostRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolUsageCostService }),
    )
    expect(trackingTranscriptionCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: baseTranscription }),
    )
    expect(trackingTranslationCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: baseTranslation }),
    )
  })

  it('resolves model/provider from environment variables', async () => {
    process.env.WHISPER_MODEL = 'gpt-4o-mini-transcribe'
    process.env.LLM_PROVIDER = 'openrouter'
    process.env.OPENROUTER_TRANSLATION_MODEL = 'openai/gpt-4o-mini'
    delete process.env.OPENROUTER_COACH_MODEL

    const toolUsageCostService = { recordLlmStreamCost: vi.fn() }
    createCostRuntimeMock.mockReturnValueOnce({
      recorder: {},
      structuredOutputCostService: {},
      toolUsageCostService,
    })

    const { createMediaToolsProviders } =
      await import('../mediaTools/infrastructure/runtimeFactory')

    createMediaToolsProviders({
      ctx: {} as any,
      threadId: 'media-tools:job_3',
    })

    const transcriptionArgs = trackingTranscriptionCtorMock.mock.calls[0]?.[0]
    const translationArgs = trackingTranslationCtorMock.mock.calls[0]?.[0]
    expect(transcriptionArgs.modelIdResolver()).toBe('gpt-4o-mini-transcribe')
    expect(translationArgs.providerNameResolver()).toBe('openrouter')
    expect(translationArgs.modelIdResolver()).toBe('openai/gpt-4o-mini')
  })
})
