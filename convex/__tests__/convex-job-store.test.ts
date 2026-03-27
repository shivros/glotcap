import { describe, expect, it, vi } from 'vitest'
import { ConvexJobStore } from '../mediaTools/infrastructure/convexJobStore'

describe('ConvexJobStore', () => {
  it('delegates getJobForProcessing to internal query', async () => {
    const runQuery = vi.fn(() => Promise.resolve({ _id: 'job-1' }))
    const runMutation = vi.fn(() => Promise.resolve())
    const store = new ConvexJobStore({
      runQuery,
      runMutation,
    } as any)

    const result = await store.getJobForProcessing('job-1' as any)

    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ _id: 'job-1' })
  })

  it('maps completeJob payload and calls internal mutation', async () => {
    const runQuery = vi.fn(() => Promise.resolve(null))
    const runMutation = vi.fn(() => Promise.resolve())
    const store = new ConvexJobStore({
      runQuery,
      runMutation,
    } as any)

    await store.completeJob('job-1' as any, {
      transcriptText: 'hello',
      srtText: undefined,
      bilingualTranscriptText: undefined,
      bilingualSrtText: undefined,
      segments: [
        {
          segmentIndex: 1,
          startMs: 0,
          endMs: 1000,
          originalText: 'hola',
          translatedText: 'hello',
        },
      ],
    })

    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jobId: 'job-1',
        transcriptText: 'hello',
        segments: [
          expect.objectContaining({
            segmentIndex: 1,
            originalText: 'hola',
            translatedText: 'hello',
          }),
        ],
      }),
    )
  })

  it('delegates markProcessing and failJob mutations', async () => {
    const runQuery = vi.fn(() => Promise.resolve(null))
    const runMutation = vi.fn(() => Promise.resolve())
    const store = new ConvexJobStore({
      runQuery,
      runMutation,
    } as any)

    await store.markProcessing('job-1' as any)
    await store.failJob('job-1' as any, 'boom')

    expect(runMutation).toHaveBeenCalledTimes(2)
  })
})
