import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaToolController } from '@/lib/tools/use-media-tool-controller'

const queryState = vi.hoisted(() => ({
  job: null as Record<string, unknown> | null,
}))

const mutationMocks = vi.hoisted(() => ({
  generateUploadUrl: vi.fn(() => Promise.resolve('https://upload.example')),
  createJob: vi.fn(() => Promise.resolve({ jobId: 'job-1' })),
  callIndex: 0,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    mediaTools: {
      generateUploadUrl: 'generateUploadUrl',
      createJob: 'createJob',
      getJob: 'getJob',
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: () => {
    mutationMocks.callIndex += 1
    return mutationMocks.callIndex % 2 === 1
      ? mutationMocks.generateUploadUrl
      : mutationMocks.createJob
  },
  useQuery: () => queryState.job,
}))

describe('useMediaToolController', () => {
  beforeEach(() => {
    queryState.job = null
    mutationMocks.generateUploadUrl.mockClear()
    mutationMocks.createJob.mockClear()
    mutationMocks.callIndex = 0
    vi.unstubAllGlobals()
  })

  it('shows validation error when submit runs without a file', async () => {
    const { result } = renderHook(() => useMediaToolController('transcript'))

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.localError).toContain(
      'Please choose an audio or SRT file',
    )
  })

  it('requires target language for bilingual mode', async () => {
    const { result } = renderHook(() => useMediaToolController('bilingual'))
    act(() => {
      result.current.setFile(
        new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }),
      )
      result.current.setTargetLanguage('  ')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.localError).toContain('Target language is required')
  })

  it('submits upload and createJob successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ storageId: 'storage-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )

    const { result } = renderHook(() => useMediaToolController('transcript'))
    act(() => {
      result.current.setFile(
        new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }),
      )
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(mutationMocks.generateUploadUrl).toHaveBeenCalledTimes(1)
    expect(mutationMocks.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'transcript',
        inputFileName: 'clip.mp3',
      }),
    )
    expect(result.current.localError).toBeNull()
  })

  it('surfaces upload failure errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))),
    )

    const { result } = renderHook(() => useMediaToolController('transcript'))
    act(() => {
      result.current.setFile(
        new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }),
      )
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.localError).toContain('Upload failed')
  })

  it('computes primary output from query state', () => {
    queryState.job = {
      status: 'completed',
      transcriptText: 'hello transcript',
      srtText: '1\n00:00:00,000 --> 00:00:01,000\nhello',
      bilingualTranscriptText: 'hola\n---\nhello',
      bilingualSrtText: '1\n00:00:00,000 --> 00:00:01,000\nhola\n---\nhello',
    }

    const { result } = renderHook(() => useMediaToolController('srt'))

    expect(result.current.primaryOutput).toContain('-->')
    expect(result.current.isProcessing).toBe(false)
  })
})
