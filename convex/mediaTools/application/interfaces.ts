import type { Id } from '../../_generated/dataModel'
import type { SubtitleSegment } from '../../mediaToolsDomain'
import type { LoadedInput, ProcessingJob, ToolProcessResult } from './types'

export interface ITranscriptionProvider {
  transcribe: (args: {
    blob: Blob
    fileName: string
    sourceLanguage?: string
  }) => Promise<LoadedInput>
}

export interface ITranslationProvider {
  translateSegment: (args: {
    text: string
    sourceLanguage?: string
    targetLanguage: string
  }) => Promise<string>
}

export interface IInputLoader {
  load: (args: {
    storageId: Id<'_storage'>
    fileName: string
    sourceLanguage?: string
  }) => Promise<LoadedInput>
}

export interface IToolProcessor {
  process: (args: {
    job: ProcessingJob
    segments: Array<SubtitleSegment>
  }) => Promise<ToolProcessResult>
}

export interface IJobStore {
  getJobForProcessing: (
    jobId: Id<'mediaToolJobs'>,
  ) => Promise<ProcessingJob | null>
  markProcessing: (jobId: Id<'mediaToolJobs'>) => Promise<void>
  completeJob: (
    jobId: Id<'mediaToolJobs'>,
    result: ToolProcessResult,
  ) => Promise<void>
  failJob: (jobId: Id<'mediaToolJobs'>, errorMessage: string) => Promise<void>
}
