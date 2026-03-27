import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { ActionCtx } from '../../_generated/server'
import type { IJobStore } from '../application/interfaces'
import type { ProcessingJob, ToolProcessResult } from '../application/types'

const toSegmentsPayload = (segments: ToolProcessResult['segments']) =>
  segments.map((segment) => ({
    segmentIndex: segment.segmentIndex,
    startMs: segment.startMs,
    endMs: segment.endMs,
    originalText: segment.originalText,
    translatedText: segment.translatedText,
  }))

export class ConvexJobStore implements IJobStore {
  constructor(private readonly ctx: ActionCtx) {}

  async getJobForProcessing(
    jobId: Id<'mediaToolJobs'>,
  ): Promise<ProcessingJob | null> {
    return await this.ctx.runQuery(internal.mediaTools.getJobForProcessing, {
      jobId,
    })
  }

  async markProcessing(jobId: Id<'mediaToolJobs'>) {
    await this.ctx.runMutation(internal.mediaTools.markJobProcessing, {
      jobId,
    })
  }

  async completeJob(jobId: Id<'mediaToolJobs'>, result: ToolProcessResult) {
    await this.ctx.runMutation(internal.mediaTools.completeJob, {
      jobId,
      transcriptText: result.transcriptText,
      srtText: result.srtText,
      bilingualTranscriptText: result.bilingualTranscriptText,
      bilingualSrtText: result.bilingualSrtText,
      segments: toSegmentsPayload(result.segments),
    })
  }

  async failJob(jobId: Id<'mediaToolJobs'>, errorMessage: string) {
    await this.ctx.runMutation(internal.mediaTools.failJob, {
      jobId,
      errorMessage,
    })
  }
}
