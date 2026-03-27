import { ConvexError, v } from 'convex/values'

import { requireAuthUserId, requireOwnedSession } from './sessionAuth'
import {
  deriveInsightLabel,
  getCorrectionExplanation,
  getCorrectionStrings,
  normalizeKey,
} from './learningInsights/normalization'
import { computeRecencyScore } from './learningInsights/scoring'
import { internalMutation, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'

const HALF_LIFE_DAYS_DEFAULT = 30
const EXAMPLES_PER_INSIGHT = 3
const EXAMPLE_POOL_LIMIT = 6
const MIN_OCCURRENCES = 2

const computeScore = (
  count: number,
  lastSeenAt: number,
  now: number,
  halfLifeDays: number,
) => computeRecencyScore({ count, lastSeenAt, now, halfLifeDays })

export const processSessionInsights = internalMutation({
  args: {
    sessionId: v.id('speakingSessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const userId = session.userId
    if (!userId) {
      return { skipped: 'no_user' }
    }

    if (session.status !== 'ended' && session.status !== 'limit_reached') {
      return { skipped: 'session_active' }
    }

    const existing = await ctx.db
      .query('learningInsightItems')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .take(1)
    if (existing.length > 0) {
      return { skipped: 'already_processed' }
    }

    const events = await ctx.db
      .query('speakingEvents')
      .withIndex('by_session_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .collect()

    const exampleRejectionRows = await ctx.db
      .query('learningInsightExampleRejections')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', session.targetLanguage),
      )
      .collect()
    const rejectedExampleIds = new Set(
      exampleRejectionRows.map((row) => row.correctionId),
    )

    const corrections = events.filter(
      (event) =>
        event.type === 'correction' &&
        event.severity !== 'positive' &&
        !rejectedExampleIds.has(event._id),
    )

    if (corrections.length === 0) {
      return { skipped: 'no_corrections' }
    }

    const transcriptCache = new Map<
      Id<'speakingEvents'>,
      Doc<'speakingEvents'>
    >()
    const getTranscriptText = async (eventId?: Id<'speakingEvents'>) => {
      if (!eventId) {
        return null
      }
      if (transcriptCache.has(eventId)) {
        return transcriptCache.get(eventId)?.text ?? null
      }
      const event = await ctx.db.get(eventId)
      if (event && event.type === 'transcript') {
        transcriptCache.set(eventId, event)
        return event.text ?? null
      }
      return null
    }

    const rejectionRows = await ctx.db
      .query('learningInsightRejections')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', session.targetLanguage),
      )
      .collect()
    const rejectionKeys = new Set(rejectionRows.map((row) => row.canonicalKey))

    const profileRows = await ctx.db
      .query('learningInsightProfile')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', session.targetLanguage),
      )
      .collect()
    const rejectedProfileKeys = new Set(
      profileRows
        .filter((row) => row.status === 'rejected')
        .map((row) => row.canonicalKey),
    )

    const grouped = new Map<
      string,
      {
        canonical: string
        canonicalKey: string
        category: string
        confidence: number
        count: number
        examples: Array<{
          original: string
          corrected: string
          explanation: string
          correctionId: Id<'speakingEvents'>
          timestamp: number
        }>
        sourceCorrectionIds: Array<Id<'speakingEvents'>>
        firstSeenAt: number
        lastSeenAt: number
      }
    >()

    for (const correction of corrections) {
      const label = deriveInsightLabel({
        title: correction.title ?? null,
        detail: correction.detail ?? null,
        category: (correction.payload as { category?: string } | undefined)
          ?.category,
      })
      if (!label) {
        continue
      }

      const transcriptText = await getTranscriptText(
        correction.referenceEventId,
      )
      const textPair = getCorrectionStrings(correction, transcriptText)
      if (!textPair) {
        continue
      }
      const explanation = getCorrectionExplanation(correction)
      if (!explanation) {
        continue
      }

      const key = label.canonicalKey
      const bucket = grouped.get(key) ?? {
        canonical: label.canonical,
        canonicalKey: label.canonicalKey,
        category: label.category,
        confidence: label.confidence,
        count: 0,
        examples: [],
        sourceCorrectionIds: [],
        firstSeenAt: correction.createdAt,
        lastSeenAt: correction.createdAt,
      }

      bucket.count += 1
      bucket.sourceCorrectionIds.push(correction._id)
      bucket.firstSeenAt = Math.min(bucket.firstSeenAt, correction.createdAt)
      bucket.lastSeenAt = Math.max(bucket.lastSeenAt, correction.createdAt)
      if (bucket.examples.length < EXAMPLES_PER_INSIGHT) {
        bucket.examples.push({
          original: textPair.original,
          corrected: textPair.corrected,
          explanation,
          correctionId: correction._id,
          timestamp: correction.createdAt,
        })
      }

      grouped.set(key, bucket)
    }

    const now = Date.now()
    const insights = Array.from(grouped.values())
      .filter((item) => item.count >= MIN_OCCURRENCES)
      .filter(
        (item) =>
          !rejectionKeys.has(item.canonicalKey) &&
          !rejectedProfileKeys.has(item.canonicalKey),
      )

    if (insights.length === 0) {
      return { skipped: 'no_insights' }
    }

    for (const insight of insights) {
      await ctx.db.insert('learningInsightItems', {
        userId,
        sessionId: args.sessionId,
        language: session.targetLanguage,
        canonical: insight.canonical,
        canonicalKey: insight.canonicalKey,
        category: insight.category,
        confidence: insight.confidence,
        count: insight.count,
        examples: insight.examples,
        sourceCorrectionIds: insight.sourceCorrectionIds,
        firstSeenAt: insight.firstSeenAt,
        lastSeenAt: insight.lastSeenAt,
        createdAt: now,
        updatedAt: now,
      })

      const profile = await ctx.db
        .query('learningInsightProfile')
        .withIndex('by_user_language_canonicalKey', (q) =>
          q
            .eq('userId', userId)
            .eq('language', session.targetLanguage)
            .eq('canonicalKey', insight.canonicalKey),
        )
        .unique()

      const mergedExamples = [
        ...insight.examples.map((example) => ({
          ...example,
        })),
        ...(profile?.examples ?? []),
      ]
      const exampleMap = new Map<string, (typeof mergedExamples)[number]>()
      for (const example of mergedExamples) {
        exampleMap.set(example.correctionId, example)
      }
      const examplePool = Array.from(exampleMap.values())
        .filter((example) => !rejectedExampleIds.has(example.correctionId))
        .slice(0, EXAMPLE_POOL_LIMIT)

      if (!profile) {
        await ctx.db.insert('learningInsightProfile', {
          userId,
          language: session.targetLanguage,
          canonical: insight.canonical,
          canonicalKey: insight.canonicalKey,
          category: insight.category,
          totalCount: insight.count,
          firstSeenAt: insight.firstSeenAt,
          lastSeenAt: insight.lastSeenAt,
          examples: examplePool,
          status: 'active',
          rejectedAt: null,
          rejectedReason: null,
          createdAt: now,
          updatedAt: now,
        })
      } else if (profile.status !== 'rejected') {
        await ctx.db.patch(profile._id, {
          totalCount: profile.totalCount + insight.count,
          firstSeenAt: Math.min(profile.firstSeenAt, insight.firstSeenAt),
          lastSeenAt: Math.max(profile.lastSeenAt, insight.lastSeenAt),
          examples: examplePool,
          updatedAt: now,
        })
      }
    }

    return { inserted: insights.length }
  },
})

export const listLearningInsights = query({
  args: {
    language: v.string(),
    halfLifeDays: v.optional(v.number()),
    includeRejected: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const halfLifeDays = Math.max(
      args.halfLifeDays ?? HALF_LIFE_DAYS_DEFAULT,
      1,
    )

    const profiles = await ctx.db
      .query('learningInsightProfile')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', args.language),
      )
      .collect()

    const items = await ctx.db
      .query('learningInsightItems')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', args.language),
      )
      .collect()

    const exampleRejections = await ctx.db
      .query('learningInsightExampleRejections')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', args.language),
      )
      .collect()
    const rejectedExampleIds = new Set(
      exampleRejections.map((row) => row.correctionId),
    )
    const exampleCounts = new Map<string, { total: number; ignored: number }>()
    const seenByKey = new Map<string, Set<Id<'speakingEvents'>>>()
    for (const item of items) {
      if (item.sourceCorrectionIds.length === 0) {
        continue
      }
      let seenForKey = seenByKey.get(item.canonicalKey)
      if (!seenForKey) {
        seenForKey = new Set()
        seenByKey.set(item.canonicalKey, seenForKey)
      }
      const counts = exampleCounts.get(item.canonicalKey) ?? {
        total: 0,
        ignored: 0,
      }
      for (const correctionId of item.sourceCorrectionIds) {
        if (seenForKey.has(correctionId)) {
          continue
        }
        seenForKey.add(correctionId)
        counts.total += 1
        if (rejectedExampleIds.has(correctionId)) {
          counts.ignored += 1
        }
      }
      exampleCounts.set(item.canonicalKey, counts)
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.canonicalKey, profile]),
    )

    const scores = new Map<string, number>()
    const now = Date.now()
    for (const item of items) {
      const profile = profileMap.get(item.canonicalKey)
      if (!profile || profile.status === 'rejected') {
        continue
      }
      const score = computeScore(item.count, item.lastSeenAt, now, halfLifeDays)
      scores.set(
        item.canonicalKey,
        (scores.get(item.canonicalKey) ?? 0) + score,
      )
    }

    const includeRejected = args.includeRejected ?? false

    return profiles
      .filter((profile) => includeRejected || profile.status !== 'rejected')
      .map((profile) => ({
        _id: profile._id,
        canonical: profile.canonical,
        canonicalKey: profile.canonicalKey,
        category: profile.category,
        totalCount: Math.max(
          (exampleCounts.get(profile.canonicalKey)?.total ??
            profile.totalCount) -
            (exampleCounts.get(profile.canonicalKey)?.ignored ?? 0),
          0,
        ),
        ignoredCount: exampleCounts.get(profile.canonicalKey)?.ignored ?? 0,
        firstSeenAt: profile.firstSeenAt,
        lastSeenAt: profile.lastSeenAt,
        examples: (profile.examples ?? [])
          .map((example) => ({
            ...example,
            rejected: rejectedExampleIds.has(example.correctionId),
          }))
          .filter((example) => includeRejected || !example.rejected),
        score: scores.get(profile.canonicalKey) ?? 0,
        status: profile.status,
      }))
      .sort((a, b) => b.score - a.score)
  },
})

export const listSessionInsights = query({
  args: {
    sessionId: v.id('speakingSessions'),
  },
  handler: async (ctx, args) => {
    await requireOwnedSession(ctx, args.sessionId)

    return ctx.db
      .query('learningInsightItems')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect()
  },
})

export const listLearningInsightExamples = query({
  args: {
    language: v.string(),
    canonicalKey: v.string(),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    includeRejected: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const canonicalKey = normalizeKey(args.canonicalKey)
    const items = await ctx.db
      .query('learningInsightItems')
      .withIndex('by_user_language_canonicalKey', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('canonicalKey', canonicalKey),
      )
      .collect()

    if (items.length === 0) {
      return { totalCount: 0, examples: [] }
    }

    const exampleRejections = await ctx.db
      .query('learningInsightExampleRejections')
      .withIndex('by_user_language', (q) =>
        q.eq('userId', userId).eq('language', args.language),
      )
      .collect()
    const rejectedExampleIds = new Set(
      exampleRejections.map((row) => row.correctionId),
    )

    const sortedItems = [...items].sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    const seen = new Set<string>()
    const allIds: Array<Id<'speakingEvents'>> = []
    for (const item of sortedItems) {
      for (
        let index = item.sourceCorrectionIds.length - 1;
        index >= 0;
        index -= 1
      ) {
        const id = item.sourceCorrectionIds[index]
        if (seen.has(id)) {
          continue
        }
        seen.add(id)
        allIds.push(id)
      }
    }

    const includeRejected = args.includeRejected ?? false
    const filteredIds = includeRejected
      ? allIds
      : allIds.filter((id) => !rejectedExampleIds.has(id))
    const totalCount = filteredIds.length
    const pageSize = Math.max(1, Math.min(args.pageSize ?? 3, 25))
    const page = Math.max(1, args.page ?? 1)
    const start = (page - 1) * pageSize
    const pageIds = filteredIds.slice(start, start + pageSize)

    const transcriptCache = new Map<
      Id<'speakingEvents'>,
      Doc<'speakingEvents'>
    >()
    const getTranscriptText = async (eventId?: Id<'speakingEvents'>) => {
      if (!eventId) {
        return null
      }
      if (transcriptCache.has(eventId)) {
        return transcriptCache.get(eventId)?.text ?? null
      }
      const event = await ctx.db.get(eventId)
      if (event && event.type === 'transcript') {
        transcriptCache.set(eventId, event)
        return event.text ?? null
      }
      return null
    }

    const correctionDocs = await Promise.all(
      pageIds.map((id) => ctx.db.get(id)),
    )
    const examples: Array<{
      original: string
      corrected: string
      explanation?: string | null
      correctionId: Id<'speakingEvents'>
      timestamp: number
      rejected: boolean
    }> = []

    for (const correction of correctionDocs) {
      if (!correction || correction.type !== 'correction') {
        continue
      }
      const transcriptText = await getTranscriptText(
        correction.referenceEventId,
      )
      const textPair = getCorrectionStrings(correction, transcriptText)
      if (!textPair) {
        continue
      }
      const explanation = getCorrectionExplanation(correction)
      examples.push({
        original: textPair.original,
        corrected: textPair.corrected,
        explanation,
        correctionId: correction._id,
        timestamp: correction.createdAt,
        rejected: rejectedExampleIds.has(correction._id),
      })
    }

    return { totalCount, examples }
  },
})

export const rejectLearningInsightExample = mutation({
  args: {
    language: v.string(),
    correctionId: v.id('speakingEvents'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const correction = await ctx.db.get(args.correctionId)
    if (!correction || correction.type !== 'correction') {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Correction not found.',
      })
    }

    const session = await ctx.db.get(correction.sessionId)
    if (!session || session.userId !== userId) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Correction not found.',
      })
    }

    if (session.targetLanguage !== args.language) {
      throw new ConvexError({
        code: 'INVALID',
        message: 'Correction language mismatch.',
      })
    }

    const canonical = deriveInsightLabel({
      title: correction.title ?? null,
      detail: correction.detail ?? null,
      category: (correction.payload as { category?: string } | undefined)
        ?.category,
    })

    const existing = await ctx.db
      .query('learningInsightExampleRejections')
      .withIndex('by_user_language_correctionId', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('correctionId', args.correctionId),
      )
      .unique()

    if (!existing) {
      const now = Date.now()
      await ctx.db.insert('learningInsightExampleRejections', {
        userId,
        language: args.language,
        correctionId: args.correctionId,
        canonicalKey: canonical?.canonicalKey ?? null,
        rejectedAt: now,
        reason: args.reason ?? null,
        createdAt: now,
      })
    }

    return { status: 'rejected' }
  },
})

export const restoreLearningInsightExample = mutation({
  args: {
    language: v.string(),
    correctionId: v.id('speakingEvents'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const existing = await ctx.db
      .query('learningInsightExampleRejections')
      .withIndex('by_user_language_correctionId', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('correctionId', args.correctionId),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }

    return { status: 'active' }
  },
})

export const rejectLearningInsight = mutation({
  args: {
    language: v.string(),
    canonical: v.string(),
    canonicalKey: v.string(),
    category: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const now = Date.now()
    const canonicalKey = normalizeKey(args.canonicalKey || args.canonical)

    const existing = await ctx.db
      .query('learningInsightRejections')
      .withIndex('by_user_language_canonicalKey', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('canonicalKey', canonicalKey),
      )
      .unique()

    if (!existing) {
      await ctx.db.insert('learningInsightRejections', {
        userId,
        language: args.language,
        canonical: args.canonical,
        canonicalKey,
        category: args.category ?? null,
        rejectedAt: now,
        reason: args.reason ?? null,
        createdAt: now,
      })
    }

    const profile = await ctx.db
      .query('learningInsightProfile')
      .withIndex('by_user_language_canonicalKey', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('canonicalKey', canonicalKey),
      )
      .unique()

    if (profile && profile.status !== 'rejected') {
      await ctx.db.patch(profile._id, {
        status: 'rejected',
        rejectedAt: now,
        rejectedReason: args.reason ?? null,
        updatedAt: now,
      })
    }

    return { status: 'rejected' }
  },
})

export const restoreLearningInsight = mutation({
  args: {
    language: v.string(),
    canonicalKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx)

    const canonicalKey = normalizeKey(args.canonicalKey)

    const rejection = await ctx.db
      .query('learningInsightRejections')
      .withIndex('by_user_language_canonicalKey', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('canonicalKey', canonicalKey),
      )
      .unique()

    if (rejection) {
      await ctx.db.delete(rejection._id)
    }

    const profile = await ctx.db
      .query('learningInsightProfile')
      .withIndex('by_user_language_canonicalKey', (q) =>
        q
          .eq('userId', userId)
          .eq('language', args.language)
          .eq('canonicalKey', canonicalKey),
      )
      .unique()

    if (profile && profile.status === 'rejected') {
      await ctx.db.patch(profile._id, {
        status: 'active',
        rejectedAt: null,
        rejectedReason: null,
        updatedAt: Date.now(),
      })
    }

    return { status: 'active' }
  },
})
