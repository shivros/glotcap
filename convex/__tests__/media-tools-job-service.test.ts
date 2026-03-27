import { describe, expect, it, vi } from 'vitest'
import { MediaToolJobService } from '../mediaTools/application/jobService'
import type {
  IInputLoader,
  IJobStore,
  IToolProcessor,
} from '../mediaTools/application/interfaces'
import type {
  MediaToolType,
  ProcessingJob,
} from '../mediaTools/application/types'

const createJob = (overrides?: Partial<ProcessingJob>): ProcessingJob => ({
  _id: 'job-1' as any,
  userId: 'user-1' as any,
  tool: 'transcript',
  status: 'queued',
  inputStorageId: 'storage-1' as any,
  inputFileName: 'audio.mp3',
  ...overrides,
})

const createDependencies = (job: ProcessingJob | null) => {
  const inputLoader: IInputLoader = {
    load: vi.fn(() =>
      Promise.resolve({
        transcript: 'hello world',
        segments: [{ segmentIndex: 1, originalText: 'hello world' }],
      }),
    ),
  }

  const processors: Record<MediaToolType, IToolProcessor> = {
    transcript: {
      process: vi.fn(({ segments }) =>
        Promise.resolve({
          transcriptText: 'hello world',
          segments,
        }),
      ),
    },
    srt: {
      process: vi.fn(({ segments }) =>
        Promise.resolve({
          srtText: '1\n00:00:00,000 --> 00:00:01,000\nhello world',
          segments,
        }),
      ),
    },
    bilingual: {
      process: vi.fn(({ segments }) =>
        Promise.resolve({
          bilingualTranscriptText: 'hello\n---\nhola',
          segments,
        }),
      ),
    },
  }

  const jobStore: IJobStore = {
    getJobForProcessing: vi.fn(() => Promise.resolve(job)),
    markProcessing: vi.fn(() => Promise.resolve()),
    completeJob: vi.fn(() => Promise.resolve()),
    failJob: vi.fn(() => Promise.resolve()),
  }

  return { inputLoader, processors, jobStore }
}

describe('MediaToolJobService', () => {
  it('returns early when no job exists', async () => {
    const deps = createDependencies(null)
    const service = new MediaToolJobService(deps)

    await service.run('job-1' as any)

    expect(deps.jobStore.getJobForProcessing).toHaveBeenCalled()
    expect(deps.jobStore.markProcessing).not.toHaveBeenCalled()
    expect(deps.inputLoader.load).not.toHaveBeenCalled()
  })

  it('returns early for completed jobs', async () => {
    const deps = createDependencies(createJob({ status: 'completed' }))
    const service = new MediaToolJobService(deps)

    await service.run('job-1' as any)

    expect(deps.jobStore.markProcessing).not.toHaveBeenCalled()
    expect(deps.inputLoader.load).not.toHaveBeenCalled()
  })

  it('processes and completes a job successfully', async () => {
    const job = createJob({ tool: 'transcript' })
    const deps = createDependencies(job)
    const service = new MediaToolJobService(deps)

    await service.run(job._id)

    expect(deps.jobStore.markProcessing).toHaveBeenCalledWith(job._id)
    expect(deps.inputLoader.load).toHaveBeenCalledWith({
      storageId: job.inputStorageId,
      fileName: job.inputFileName,
      sourceLanguage: job.sourceLanguage,
    })
    expect(deps.processors.transcript.process).toHaveBeenCalled()
    expect(deps.jobStore.completeJob).toHaveBeenCalled()
    expect(deps.jobStore.failJob).not.toHaveBeenCalled()
  })

  it('fails the job when processing throws', async () => {
    const job = createJob({ tool: 'srt' })
    const deps = createDependencies(job)
    ;(
      deps.processors.srt.process as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('boom'))
    const service = new MediaToolJobService(deps)

    await service.run(job._id)

    expect(deps.jobStore.completeJob).not.toHaveBeenCalled()
    expect(deps.jobStore.failJob).toHaveBeenCalledWith(job._id, 'boom')
  })
})
