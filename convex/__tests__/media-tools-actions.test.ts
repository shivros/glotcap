// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const providersFactoryMock = vi.fn()
const registryFactoryMock = vi.fn()
const serviceRunMock = vi.fn()

vi.mock('../_generated/server', () => ({
  internalAction: (definition: unknown) => definition,
}))

vi.mock('../mediaTools/infrastructure/runtimeFactory', () => ({
  createMediaToolsProviders: (...args: Array<unknown>) =>
    providersFactoryMock(...args),
}))

vi.mock('../mediaTools/application/processors', () => ({
  createToolProcessorRegistry: (...args: Array<unknown>) =>
    registryFactoryMock(...args),
}))

vi.mock('../mediaTools/application/jobService', () => ({
  MediaToolJobService: class {
    run = serviceRunMock
  },
}))

describe('mediaToolsActions.processJob', () => {
  it('wires runtime providers into job service and runs the job', async () => {
    providersFactoryMock.mockReturnValueOnce({
      transcriptionProvider: { transcribe: vi.fn() },
      translationProvider: { translateSegment: vi.fn() },
    })
    registryFactoryMock.mockReturnValueOnce({
      transcript: { process: vi.fn() },
      srt: { process: vi.fn() },
      bilingual: { process: vi.fn() },
    })
    serviceRunMock.mockResolvedValueOnce(undefined)

    const module = await import('../mediaToolsActions')

    const ctx = {
      storage: { get: vi.fn() },
      runQuery: vi.fn(),
      runMutation: vi.fn(),
    } as any

    const result = await (module.processJob as any).handler(ctx, {
      jobId: 'job_1',
    })

    expect(providersFactoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx,
        threadId: 'media-tools:job_1',
      }),
    )
    expect(registryFactoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        translationProvider: expect.any(Object),
      }),
    )
    expect(serviceRunMock).toHaveBeenCalledWith('job_1')
    expect(result).toBeNull()
  })
})
