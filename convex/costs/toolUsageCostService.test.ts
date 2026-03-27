// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createToolUsageCostService } from './toolUsageCostService'

describe('ToolUsageCostService', () => {
  it('records llm stream usage as character units', async () => {
    const recordToolCost = vi.fn(async () => {})
    const service = createToolUsageCostService({
      recordAICost: vi.fn(async () => {}),
      recordToolCost,
    })

    await service.recordLlmStreamCost({} as any, {
      operation: 'speaking-translation-segment',
      modelId: 'openrouter/auto',
      threadId: 'speaking:1',
      inputText: 'hola',
      outputText: 'hello',
    })

    expect(recordToolCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'openrouter',
        toolId: 'openrouter/auto',
        units: 9,
        unitType: 'characters',
      }),
    )
  })

  it('records tts and stt usage with expected units', async () => {
    const recordToolCost = vi.fn(async () => {})
    const service = createToolUsageCostService({
      recordAICost: vi.fn(async () => {}),
      recordToolCost,
    })

    await service.recordTtsCost({} as any, {
      operation: 'tts',
      threadId: 'tts',
      providerName: 'google_cloud_tts',
      modelId: 'gemini-2.5-flash-tts',
      text: 'hello',
    })

    await service.recordSttSessionCost({} as any, {
      operation: 'stt',
      threadId: 'speaking:1',
      providerName: 'deepgram',
      modelId: 'nova-3',
      sessionUnits: 1,
    })

    expect(recordToolCost).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        providerId: 'google_cloud_tts',
        unitType: 'characters',
        units: 5,
      }),
    )
    expect(recordToolCost).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        providerId: 'deepgram',
        unitType: 'sessions',
        units: 1,
      }),
    )
  })

  it('records transcription by audio seconds when provided', async () => {
    const recordToolCost = vi.fn(async () => {})
    const service = createToolUsageCostService({
      recordAICost: vi.fn(async () => {}),
      recordToolCost,
    })

    await service.recordTranscriptionCost({} as any, {
      operation: 'transcribe',
      threadId: 'speaking:2',
      providerName: 'deepgram',
      modelId: 'nova-3',
      transcriptText: 'ignored',
      audioSeconds: 12,
    })

    expect(recordToolCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'deepgram',
        toolId: 'nova-3',
        units: 12,
        unitType: 'audio_seconds',
      }),
    )
  })

  it('records transcription by transcript characters when audio seconds missing', async () => {
    const recordToolCost = vi.fn(async () => {})
    const service = createToolUsageCostService({
      recordAICost: vi.fn(async () => {}),
      recordToolCost,
    })

    await service.recordTranscriptionCost({} as any, {
      operation: 'transcribe',
      threadId: 'speaking:3',
      modelId: 'nova-3',
      transcriptText: '   ',
    })

    expect(recordToolCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'soniox',
        toolId: 'nova-3',
        units: 0,
        unitType: 'characters',
      }),
    )
  })

  it('records image generation with normalized minimum units', async () => {
    const recordToolCost = vi.fn(async () => {})
    const service = createToolUsageCostService({
      recordAICost: vi.fn(async () => {}),
      recordToolCost,
    })

    await service.recordImageGenerationCost({} as any, {
      operation: 'image-gen',
      threadId: 'images:1',
      modelId: 'black-forest-labs/flux',
      imageCount: 0,
    })

    expect(recordToolCost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: 'replicate',
        toolId: 'black-forest-labs/flux',
        units: 1,
        unitType: 'images',
      }),
    )
  })
})
