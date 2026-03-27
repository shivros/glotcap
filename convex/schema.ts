import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'
import { emailChangeTables } from 'ts-common/convex/email-change'
import { passwordResetTables } from 'ts-common/convex/password-reset'
import { loggingTables } from 'ts-common/logging/convex'
import { taskErrorTables } from 'ts-common/task-errors/convex'
import { inviteTables } from 'ts-common/invites/convex'
import { waitlistTables } from 'ts-common/waitlist/convex'
import {
  persistedSpeakingSessionStatusValidator,
  sessionTerminationReasonValidator,
} from './speakingDomain'

/**
 * GlotCap database schema.
 *
 * Uses Convex Auth tables for authentication.
 * Add application tables below as needed.
 */
export default defineSchema({
  ...authTables,
  speakingSessions: defineTable({
    userId: v.optional(v.id('users')),
    demoId: v.optional(v.string()),
    mode: v.union(v.literal('demo'), v.literal('standard')),
    status: persistedSpeakingSessionStatusValidator,
    activeTurnId: v.optional(v.string()),
    sourceLanguage: v.optional(v.string()),
    targetLanguage: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    endedAt: v.optional(v.number()),
    usageMs: v.number(),
    limitMs: v.number(),
    lastChunkAt: v.optional(v.number()),
    pausedAt: v.optional(v.number()),
    lastResumedAt: v.optional(v.number()),
    pauseCount: v.optional(v.number()),
    terminationReason: v.optional(sessionTerminationReasonValidator),
  })
    .index('by_user', ['userId'])
    .index('by_user_createdAt', ['userId', 'createdAt'])
    .index('by_demo', ['demoId'])
    .index('by_status', ['status']),
  speakingSessionUsage: defineTable({
    sessionId: v.id('speakingSessions'),
    usageMs: v.number(),
    lastChunkAt: v.optional(v.number()),
  }).index('by_session', ['sessionId']),
  speakingSessionRuntime: defineTable({
    sessionId: v.id('speakingSessions'),
    activeTurnId: v.optional(v.string()),
  }).index('by_session', ['sessionId']),
  speakingEvents: defineTable({
    sessionId: v.id('speakingSessions'),
    type: v.union(
      v.literal('transcript'),
      v.literal('correction'),
      v.literal('vocabulary'),
      v.literal('system'),
    ),
    provider: v.optional(v.string()),
    speaker: v.optional(
      v.union(
        v.literal('user'),
        v.literal('teacher'),
        v.literal('coach'),
        v.literal('system'),
      ),
    ),
    text: v.optional(v.string()),
    turnId: v.optional(v.string()),
    referenceEventId: v.optional(v.id('speakingEvents')),
    streamId: v.optional(v.string()),
    streamStatus: v.optional(
      v.union(
        v.literal('streaming'),
        v.literal('done'),
        v.literal('error'),
        v.literal('canceled'),
      ),
    ),
    title: v.optional(v.string()),
    detail: v.optional(v.string()),
    severity: v.optional(
      v.union(
        v.literal('low'),
        v.literal('medium'),
        v.literal('high'),
        v.literal('positive'),
      ),
    ),
    payload: v.optional(v.any()),
    translatedText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_session_createdAt', ['sessionId', 'createdAt'])
    .index('by_stream', ['streamId']),
  learningInsightItems: defineTable({
    userId: v.id('users'),
    sessionId: v.id('speakingSessions'),
    language: v.string(),
    canonical: v.string(),
    canonicalKey: v.string(),
    category: v.string(),
    confidence: v.optional(v.number()),
    count: v.number(),
    examples: v.array(
      v.object({
        original: v.string(),
        corrected: v.string(),
        explanation: v.optional(v.string()),
        correctionId: v.id('speakingEvents'),
        timestamp: v.number(),
      }),
    ),
    sourceCorrectionIds: v.array(v.id('speakingEvents')),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_user_language', ['userId', 'language'])
    .index('by_user_language_canonicalKey', [
      'userId',
      'language',
      'canonicalKey',
    ]),
  learningInsightProfile: defineTable({
    userId: v.id('users'),
    language: v.string(),
    canonical: v.string(),
    canonicalKey: v.string(),
    category: v.string(),
    totalCount: v.number(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    examples: v.optional(
      v.array(
        v.object({
          original: v.string(),
          corrected: v.string(),
          explanation: v.optional(v.string()),
          correctionId: v.id('speakingEvents'),
          timestamp: v.number(),
        }),
      ),
    ),
    status: v.union(v.literal('active'), v.literal('rejected')),
    rejectedAt: v.union(v.null(), v.number()),
    rejectedReason: v.union(v.null(), v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_language', ['userId', 'language'])
    .index('by_user_language_canonicalKey', [
      'userId',
      'language',
      'canonicalKey',
    ]),
  learningInsightRejections: defineTable({
    userId: v.id('users'),
    language: v.string(),
    canonical: v.string(),
    canonicalKey: v.string(),
    category: v.union(v.null(), v.string()),
    rejectedAt: v.number(),
    reason: v.union(v.null(), v.string()),
    createdAt: v.number(),
  })
    .index('by_user_language', ['userId', 'language'])
    .index('by_user_language_canonicalKey', [
      'userId',
      'language',
      'canonicalKey',
    ]),
  learningInsightExampleRejections: defineTable({
    userId: v.id('users'),
    language: v.string(),
    correctionId: v.id('speakingEvents'),
    canonicalKey: v.union(v.null(), v.string()),
    rejectedAt: v.number(),
    reason: v.union(v.null(), v.string()),
    createdAt: v.number(),
  })
    .index('by_user_language', ['userId', 'language'])
    .index('by_user_language_correctionId', [
      'userId',
      'language',
      'correctionId',
    ]),
  ...waitlistTables,
  ...inviteTables,
  demoUsage: defineTable({
    demoId: v.string(),
    totalMs: v.number(),
    limitMs: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_demo', ['demoId']),
  speakingDailyUsage: defineTable({
    userId: v.id('users'),
    dayStart: v.number(),
    totalMs: v.number(),
    limitMs: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_day', ['userId', 'dayStart']),
  userPreferences: defineTable({
    userId: v.id('users'),
    lastSelectedLanguageId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
  mediaToolJobs: defineTable({
    userId: v.id('users'),
    tool: v.union(
      v.literal('transcript'),
      v.literal('srt'),
      v.literal('bilingual'),
    ),
    status: v.union(
      v.literal('queued'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    inputStorageId: v.id('_storage'),
    inputFileName: v.string(),
    inputMimeType: v.optional(v.string()),
    sourceLanguage: v.optional(v.string()),
    targetLanguage: v.optional(v.string()),
    delimiter: v.optional(v.string()),
    bilingualOutput: v.optional(
      v.union(v.literal('transcript'), v.literal('srt'), v.literal('both')),
    ),
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
  })
    .index('by_user_createdAt', ['userId', 'createdAt'])
    .index('by_status', ['status']),
  mediaToolSegments: defineTable({
    jobId: v.id('mediaToolJobs'),
    segmentIndex: v.number(),
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    originalText: v.string(),
    translatedText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_job', ['jobId'])
    .index('by_job_segmentIndex', ['jobId', 'segmentIndex']),
  ...emailChangeTables,
  ...passwordResetTables,
  ...loggingTables,
  ...taskErrorTables,
})
