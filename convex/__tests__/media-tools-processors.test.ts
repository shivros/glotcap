import { describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { createToolProcessorRegistry } from '../mediaTools/application/processors'
import type { ProcessingJob } from '../mediaTools/application/types'

const baseJob: ProcessingJob = {
  _id: 'job-1' as any,
  userId: 'user-1' as any,
  tool: 'bilingual',
  status: 'queued',
  inputStorageId: 'storage-1' as any,
  inputFileName: 'input.srt',
  sourceLanguage: 'es',
  targetLanguage: 'en',
  delimiter: '---',
  bilingualOutput: 'both',
}

const segments = [
  {
    segmentIndex: 1,
    startMs: 0,
    endMs: 1000,
    originalText: 'hola',
  },
]

describe('media tool processors', () => {
  it('transcript processor returns transcript only', async () => {
    const registry = createToolProcessorRegistry({
      translationProvider: {
        translateSegment: vi.fn(() => Promise.resolve('hello')),
      },
    })

    const result = await registry.transcript.process({
      job: { ...baseJob, tool: 'transcript' },
      segments,
    })

    expect(result.transcriptText).toBe('hola')
    expect(result.srtText).toBeUndefined()
  })

  it('srt processor returns srt only', async () => {
    const registry = createToolProcessorRegistry({
      translationProvider: {
        translateSegment: vi.fn(() => Promise.resolve('hello')),
      },
    })

    const result = await registry.srt.process({
      job: { ...baseJob, tool: 'srt' },
      segments,
    })

    expect(result.srtText).toContain('-->')
    expect(result.transcriptText).toBeUndefined()
  })

  it('bilingual processor translates and emits both outputs by default', async () => {
    const translateSegment = vi.fn(() => Promise.resolve('hello'))
    const registry = createToolProcessorRegistry({
      translationProvider: { translateSegment },
    })

    const result = await registry.bilingual.process({
      job: { ...baseJob, bilingualOutput: 'both' },
      segments,
    })

    expect(translateSegment).toHaveBeenCalledTimes(1)
    expect(result.bilingualTranscriptText).toContain('---')
    expect(result.bilingualSrtText).toContain('-->')
    expect(result.segments[0]?.translatedText).toBe('hello')
  })

  it('bilingual processor respects transcript-only output mode', async () => {
    const registry = createToolProcessorRegistry({
      translationProvider: {
        translateSegment: vi.fn(() => Promise.resolve('hello')),
      },
    })

    const result = await registry.bilingual.process({
      job: { ...baseJob, bilingualOutput: 'transcript' },
      segments,
    })

    expect(result.bilingualTranscriptText).toBeTruthy()
    expect(result.bilingualSrtText).toBeUndefined()
  })

  it('bilingual processor throws when target language is missing', async () => {
    const registry = createToolProcessorRegistry({
      translationProvider: {
        translateSegment: vi.fn(() => Promise.resolve('hello')),
      },
    })

    await expect(
      registry.bilingual.process({
        job: { ...baseJob, targetLanguage: undefined },
        segments,
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })
})
