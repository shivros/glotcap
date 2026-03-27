import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

const toolValidator = v.union(
  v.literal('transcript'),
  v.literal('srt'),
  v.literal('bilingual'),
)

const statusValidator = v.union(
  v.literal('queued'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('failed'),
)

const bilingualOutputValidator = v.union(
  v.literal('transcript'),
  v.literal('srt'),
  v.literal('both'),
)

const segmentResultValidator = v.object({
  segmentIndex: v.number(),
  startMs: v.optional(v.number()),
  endMs: v.optional(v.number()),
  originalText: v.string(),
  translatedText: v.optional(v.string()),
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      })
    }
    return await ctx.storage.generateUploadUrl()
  },
})

export const createJob = mutation({
  args: {
    tool: toolValidator,
    inputStorageId: v.id('_storage'),
    inputFileName: v.string(),
    inputMimeType: v.optional(v.string()),
    sourceLanguage: v.optional(v.string()),
    targetLanguage: v.optional(v.string()),
    delimiter: v.optional(v.string()),
    bilingualOutput: v.optional(bilingualOutputValidator),
  },
  returns: v.object({ jobId: v.id('mediaToolJobs') }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      })
    }

    if (args.tool === 'bilingual' && !args.targetLanguage?.trim()) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Target language is required for bilingual output.',
      })
    }

    const metadata = await ctx.db.system.get(args.inputStorageId)
    if (!metadata) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Uploaded file not found.',
      })
    }

    if (metadata.size > MAX_UPLOAD_BYTES) {
      await ctx.storage.delete(args.inputStorageId)
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'File exceeds upload size limit.',
      })
    }

    const now = Date.now()
    const delimiter = args.delimiter?.trim() || '---'

    const jobId = await ctx.db.insert('mediaToolJobs', {
      userId,
      tool: args.tool,
      status: 'queued',
      inputStorageId: args.inputStorageId,
      inputFileName: args.inputFileName,
      inputMimeType: metadata.contentType ?? args.inputMimeType,
      sourceLanguage: args.sourceLanguage?.trim() || undefined,
      targetLanguage: args.targetLanguage?.trim() || undefined,
      delimiter,
      bilingualOutput:
        args.tool === 'bilingual'
          ? (args.bilingualOutput ?? 'both')
          : undefined,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.mediaToolsActions.processJob, {
      jobId,
    })

    return { jobId }
  },
})

export const getJob = query({
  args: { jobId: v.id('mediaToolJobs') },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('mediaToolJobs'),
      status: statusValidator,
      tool: toolValidator,
      inputFileName: v.string(),
      sourceLanguage: v.optional(v.string()),
      targetLanguage: v.optional(v.string()),
      delimiter: v.optional(v.string()),
      bilingualOutput: v.optional(bilingualOutputValidator),
      transcriptText: v.optional(v.string()),
      srtText: v.optional(v.string()),
      bilingualTranscriptText: v.optional(v.string()),
      bilingualSrtText: v.optional(v.string()),
      segmentCount: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      updatedAt: v.number(),
      segments: v.array(segmentResultValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return null
    }

    const job = await ctx.db.get(args.jobId)
    if (!job || job.userId !== userId) {
      return null
    }

    const segments = await ctx.db
      .query('mediaToolSegments')
      .withIndex('by_job_segmentIndex', (q) => q.eq('jobId', args.jobId))
      .collect()

    return {
      _id: job._id,
      status: job.status,
      tool: job.tool,
      inputFileName: job.inputFileName,
      sourceLanguage: job.sourceLanguage,
      targetLanguage: job.targetLanguage,
      delimiter: job.delimiter,
      bilingualOutput: job.bilingualOutput,
      transcriptText: job.transcriptText,
      srtText: job.srtText,
      bilingualTranscriptText: job.bilingualTranscriptText,
      bilingualSrtText: job.bilingualSrtText,
      segmentCount: job.segmentCount,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt,
      segments: segments.map((segment) => ({
        segmentIndex: segment.segmentIndex,
        startMs: segment.startMs,
        endMs: segment.endMs,
        originalText: segment.originalText,
        translatedText: segment.translatedText,
      })),
    }
  },
})

export const listRecentJobs = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id('mediaToolJobs'),
      status: statusValidator,
      tool: toolValidator,
      inputFileName: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      errorMessage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    const limit = Math.max(1, Math.min(args.limit ?? 20, 50))
    const jobs = await ctx.db
      .query('mediaToolJobs')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit)

    return jobs.map((job) => ({
      _id: job._id,
      status: job.status,
      tool: job.tool,
      inputFileName: job.inputFileName,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      errorMessage: job.errorMessage,
    }))
  },
})

export const getJobForProcessing = internalQuery({
  args: { jobId: v.id('mediaToolJobs') },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('mediaToolJobs'),
      userId: v.id('users'),
      tool: toolValidator,
      status: statusValidator,
      inputStorageId: v.id('_storage'),
      inputFileName: v.string(),
      sourceLanguage: v.optional(v.string()),
      targetLanguage: v.optional(v.string()),
      delimiter: v.optional(v.string()),
      bilingualOutput: v.optional(bilingualOutputValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) {
      return null
    }

    return {
      _id: job._id,
      userId: job.userId,
      tool: job.tool,
      status: job.status,
      inputStorageId: job.inputStorageId,
      inputFileName: job.inputFileName,
      sourceLanguage: job.sourceLanguage,
      targetLanguage: job.targetLanguage,
      delimiter: job.delimiter,
      bilingualOutput: job.bilingualOutput,
    }
  },
})

export const markJobProcessing = internalMutation({
  args: { jobId: v.id('mediaToolJobs') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) {
      return null
    }
    const now = Date.now()
    await ctx.db.patch(job._id, {
      status: 'processing',
      startedAt: job.startedAt ?? now,
      errorMessage: undefined,
      updatedAt: now,
    })
    return null
  },
})

export const completeJob = internalMutation({
  args: {
    jobId: v.id('mediaToolJobs'),
    transcriptText: v.optional(v.string()),
    srtText: v.optional(v.string()),
    bilingualTranscriptText: v.optional(v.string()),
    bilingualSrtText: v.optional(v.string()),
    segments: v.array(segmentResultValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) {
      return null
    }

    const now = Date.now()
    const existingSegments = await ctx.db
      .query('mediaToolSegments')
      .withIndex('by_job', (q) => q.eq('jobId', args.jobId))
      .collect()

    await Promise.all(
      existingSegments.map((segment) => ctx.db.delete(segment._id)),
    )

    await Promise.all(
      args.segments.map((segment) =>
        ctx.db.insert('mediaToolSegments', {
          jobId: args.jobId,
          segmentIndex: segment.segmentIndex,
          startMs: segment.startMs,
          endMs: segment.endMs,
          originalText: segment.originalText,
          translatedText: segment.translatedText,
          createdAt: now,
        }),
      ),
    )

    await ctx.db.patch(job._id, {
      status: 'completed',
      transcriptText: args.transcriptText,
      srtText: args.srtText,
      bilingualTranscriptText: args.bilingualTranscriptText,
      bilingualSrtText: args.bilingualSrtText,
      segmentCount: args.segments.length,
      completedAt: now,
      updatedAt: now,
    })

    return null
  },
})

export const failJob = internalMutation({
  args: {
    jobId: v.id('mediaToolJobs'),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)
    if (!job) {
      return null
    }
    const now = Date.now()
    await ctx.db.patch(job._id, {
      status: 'failed',
      errorMessage: args.errorMessage,
      completedAt: now,
      updatedAt: now,
    })
    return null
  },
})
