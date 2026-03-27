import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  createJob,
  generateUploadUrl,
  getJob,
  listRecentJobs,
} from '../mediaTools'

const authState = vi.hoisted(() => ({
  userId: null as string | null,
}))

vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: () => Promise.resolve(authState.userId),
}))

const createCtx = (overrides?: {
  metadata?: { contentType?: string; size: number } | null
  job?: Record<string, unknown> | null
  segments?: Array<Record<string, unknown>>
  jobs?: Array<Record<string, unknown>>
}) => {
  const metadata =
    overrides?.metadata === undefined
      ? { contentType: 'audio/mpeg', size: 1000 }
      : overrides.metadata
  const jobDoc = overrides?.job ?? null
  const segments = overrides?.segments ?? []
  const jobs = overrides?.jobs ?? []

  const insert = vi.fn(() => Promise.resolve('job-1'))
  const deleteFile = vi.fn(() => Promise.resolve())
  const runAfter = vi.fn(() => Promise.resolve())

  const db = {
    system: {
      get: vi.fn(() => Promise.resolve(metadata)),
    },
    get: vi.fn(() => Promise.resolve(jobDoc)),
    insert,
    patch: vi.fn(() => Promise.resolve()),
    query: vi.fn((table: string) => {
      if (table === 'mediaToolSegments') {
        return {
          withIndex: () => ({
            collect: () => Promise.resolve(segments),
          }),
        }
      }
      if (table === 'mediaToolJobs') {
        return {
          withIndex: () => ({
            order: () => ({
              take: () => Promise.resolve(jobs),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  return {
    ctx: {
      db,
      storage: {
        generateUploadUrl: vi.fn(() =>
          Promise.resolve('https://upload.example'),
        ),
        delete: deleteFile,
      },
      scheduler: {
        runAfter,
      },
    },
    insert,
    deleteFile,
    runAfter,
  }
}

describe('mediaTools functions', () => {
  beforeEach(() => {
    authState.userId = null
    vi.restoreAllMocks()
  })

  it('generateUploadUrl rejects unauthenticated users', async () => {
    const { ctx } = createCtx()

    await expect(
      (generateUploadUrl as any)._handler(ctx, {}),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('generateUploadUrl returns upload URL for authenticated users', async () => {
    authState.userId = 'user-1'
    const { ctx } = createCtx()

    const result = await (generateUploadUrl as any)._handler(ctx, {})

    expect(result).toBe('https://upload.example')
  })

  it('createJob validates bilingual target language', async () => {
    authState.userId = 'user-1'
    const { ctx } = createCtx()

    await expect(
      (createJob as any)._handler(ctx, {
        tool: 'bilingual',
        inputStorageId: 'storage-1',
        inputFileName: 'a.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('createJob rejects missing metadata', async () => {
    authState.userId = 'user-1'
    const { ctx } = createCtx({
      metadata: null,
    })

    await expect(
      (createJob as any)._handler(ctx, {
        tool: 'transcript',
        inputStorageId: 'storage-1',
        inputFileName: 'a.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })

  it('createJob deletes oversized uploads and fails', async () => {
    authState.userId = 'user-1'
    const { ctx, deleteFile } = createCtx({
      metadata: { contentType: 'audio/mpeg', size: 200 * 1024 * 1024 },
    })

    await expect(
      (createJob as any)._handler(ctx, {
        tool: 'transcript',
        inputStorageId: 'storage-1',
        inputFileName: 'a.mp3',
      }),
    ).rejects.toBeInstanceOf(ConvexError)

    expect(deleteFile).toHaveBeenCalledWith('storage-1')
  })

  it('createJob inserts and schedules processing for valid input', async () => {
    authState.userId = 'user-1'
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const { ctx, insert, runAfter } = createCtx()

    const result = await (createJob as any)._handler(ctx, {
      tool: 'bilingual',
      inputStorageId: 'storage-1',
      inputFileName: 'a.mp3',
      sourceLanguage: 'es',
      targetLanguage: 'en',
    })

    expect(result).toEqual({ jobId: 'job-1' })
    expect(insert).toHaveBeenCalledWith(
      'mediaToolJobs',
      expect.objectContaining({
        userId: 'user-1',
        status: 'queued',
        delimiter: '---',
        bilingualOutput: 'both',
        createdAt: 123,
      }),
    )
    expect(runAfter).toHaveBeenCalledWith(
      0,
      expect.anything(),
      expect.objectContaining({ jobId: 'job-1' }),
    )
  })

  it('getJob returns null when unauthorized', async () => {
    const { ctx } = createCtx()

    const result = await (getJob as any)._handler(ctx, { jobId: 'job-1' })

    expect(result).toBeNull()
  })

  it('getJob returns null when job owner differs', async () => {
    authState.userId = 'user-1'
    const { ctx } = createCtx({
      job: {
        _id: 'job-1',
        userId: 'someone-else',
      },
    })

    const result = await (getJob as any)._handler(ctx, { jobId: 'job-1' })

    expect(result).toBeNull()
  })

  it('getJob returns mapped segments for owner', async () => {
    authState.userId = 'user-1'
    const { ctx } = createCtx({
      job: {
        _id: 'job-1',
        userId: 'user-1',
        status: 'completed',
        tool: 'transcript',
        inputFileName: 'a.mp3',
        sourceLanguage: 'es',
        targetLanguage: 'en',
        delimiter: '---',
        bilingualOutput: 'both',
        transcriptText: 'hello',
        srtText: undefined,
        bilingualTranscriptText: undefined,
        bilingualSrtText: undefined,
        segmentCount: 1,
        errorMessage: undefined,
        createdAt: 1,
        startedAt: 2,
        completedAt: 3,
        updatedAt: 4,
      },
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

    const result = await (getJob as any)._handler(ctx, { jobId: 'job-1' })

    expect(result).toMatchObject({
      _id: 'job-1',
      segments: [
        {
          segmentIndex: 1,
          originalText: 'hola',
          translatedText: 'hello',
        },
      ],
    })
  })

  it('listRecentJobs returns empty array for unauthenticated users', async () => {
    const { ctx } = createCtx()

    const result = await (listRecentJobs as any)._handler(ctx, {})

    expect(result).toEqual([])
  })
})
