import { useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type BilingualOutput = 'transcript' | 'srt' | 'both'
export type MediaToolMode = 'transcript' | 'srt' | 'bilingual'

export const useMediaToolController = (mode: MediaToolMode) => {
  const generateUploadUrl = useMutation(api.mediaTools.generateUploadUrl)
  const createJob = useMutation(api.mediaTools.createJob)

  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<Id<'mediaToolJobs'> | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [delimiter, setDelimiter] = useState('---')
  const [bilingualOutput, setBilingualOutput] =
    useState<BilingualOutput>('both')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const job = useQuery(api.mediaTools.getJob, jobId ? { jobId } : 'skip')
  const isProcessing = job?.status === 'queued' || job?.status === 'processing'

  const primaryOutput = useMemo(() => {
    if (!job) {
      return ''
    }
    if (mode === 'transcript') {
      return job.transcriptText ?? ''
    }
    if (mode === 'srt') {
      return job.srtText ?? ''
    }
    if (bilingualOutput === 'srt') {
      return job.bilingualSrtText ?? ''
    }
    return job.bilingualTranscriptText ?? job.bilingualSrtText ?? ''
  }, [bilingualOutput, job, mode])

  const primaryOutputName = useMemo(() => {
    const base = file?.name.replace(/\.[^/.]+$/, '') || 'output'
    if (mode === 'transcript') {
      return `${base}.transcript.txt`
    }
    if (mode === 'srt') {
      return `${base}.srt`
    }
    if (bilingualOutput === 'srt') {
      return `${base}.bilingual.srt`
    }
    if (bilingualOutput === 'transcript') {
      return `${base}.bilingual.txt`
    }
    return `${base}.bilingual.txt`
  }, [bilingualOutput, file?.name, mode])

  const submit = async () => {
    if (!file) {
      setLocalError('Please choose an audio or SRT file first.')
      return
    }

    if (mode === 'bilingual' && !targetLanguage.trim()) {
      setLocalError('Target language is required for bilingual output.')
      return
    }

    setLocalError(null)
    setIsSubmitting(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed.')
      }

      const body = (await uploadResponse.json()) as { storageId?: string }
      if (!body.storageId) {
        throw new Error('Upload response did not include storageId.')
      }

      const created = await createJob({
        tool: mode,
        inputStorageId: body.storageId as Id<'_storage'>,
        inputFileName: file.name,
        inputMimeType: file.type || undefined,
        sourceLanguage: sourceLanguage.trim() || undefined,
        targetLanguage:
          mode === 'bilingual' ? targetLanguage.trim() : undefined,
        delimiter: mode === 'bilingual' ? delimiter : undefined,
        bilingualOutput: mode === 'bilingual' ? bilingualOutput : undefined,
      })

      setJobId(created.jobId)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    file,
    setFile,
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    delimiter,
    setDelimiter,
    bilingualOutput,
    setBilingualOutput,
    localError,
    isSubmitting,
    submit,
    job,
    isProcessing,
    primaryOutput,
    primaryOutputName,
  }
}
