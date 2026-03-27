import type { Id } from '../../_generated/dataModel'
import type { IInputLoader, IJobStore, IToolProcessor } from './interfaces'
import type { MediaToolType } from './types'

type Dependencies = {
  inputLoader: IInputLoader
  jobStore: IJobStore
  processors: Record<MediaToolType, IToolProcessor>
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown processing error.'
}

export class MediaToolJobService {
  constructor(private readonly dependencies: Dependencies) {}

  async run(jobId: Id<'mediaToolJobs'>) {
    const job = await this.dependencies.jobStore.getJobForProcessing(jobId)
    if (!job || job.status === 'completed') {
      return
    }

    await this.dependencies.jobStore.markProcessing(jobId)

    try {
      const loaded = await this.dependencies.inputLoader.load({
        storageId: job.inputStorageId,
        fileName: job.inputFileName,
        sourceLanguage: job.sourceLanguage,
      })

      const processor = this.dependencies.processors[job.tool]
      const result = await processor.process({
        job,
        segments: loaded.segments,
      })
      await this.dependencies.jobStore.completeJob(jobId, result)
    } catch (error) {
      await this.dependencies.jobStore.failJob(jobId, toErrorMessage(error))
    }
  }
}
