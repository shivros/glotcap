import type { Id } from '../../_generated/dataModel'
import type { SubtitleSegment } from '../../mediaToolsDomain'

export type MediaToolType = 'transcript' | 'srt' | 'bilingual'

export type BilingualOutputType = 'transcript' | 'srt' | 'both'

export type ProcessingJob = {
  _id: Id<'mediaToolJobs'>
  userId: Id<'users'>
  tool: MediaToolType
  status: 'queued' | 'processing' | 'completed' | 'failed'
  inputStorageId: Id<'_storage'>
  inputFileName: string
  sourceLanguage?: string
  targetLanguage?: string
  delimiter?: string
  bilingualOutput?: BilingualOutputType
}

export type LoadedInput = {
  transcript: string
  segments: Array<SubtitleSegment>
}

export type ToolProcessResult = {
  transcriptText?: string
  srtText?: string
  bilingualTranscriptText?: string
  bilingualSrtText?: string
  segments: Array<SubtitleSegment>
}
