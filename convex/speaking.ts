import { getAuthUserId } from '@convex-dev/auth/server'
import { makeFunctionReference } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { streamingComponent } from './streaming'
import {
  AUTH_DAILY_LIMIT_MS,
  resolveDemoLimitSource,
  resolveDemoSessionLimitMs,
} from './speakingPolicy'
import {
  resolveEndSessionState,
  resolveUsageTransition,
} from './sessionStateMachine'
import { requireOwnedSession } from './sessionAuth'
import { sessionTerminationReasonValidator } from './speakingDomain'
import type { Doc, Id } from './_generated/dataModel'
import type { DatabaseReader } from './_generated/server'
import type { SessionTerminationReason } from './speakingDomain'

const HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const MAX_CHUNK_MS = 15000

export const getDemoLimit = query({
  args: {},
  handler: () => {
    const limitMs = resolveDemoSessionLimitMs()

    return {
      limitMs,
      disabled: limitMs <= 0,
      source: resolveDemoLimitSource(),
    }
  },
})

const clampDeltaMs = (value: number) =>
  Math.max(0, Math.min(value, MAX_CHUNK_MS))

const getUtcDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const getLatestUsageDoc = async (
  db: DatabaseReader,
  sessionId: Id<'speakingSessions'>,
): Promise<Doc<'speakingSessionUsage'> | null> => {
  const usage = await db
    .query('speakingSessionUsage')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .order('desc')
    .take(1)
  return usage[0] ?? null
}

const getLatestRuntimeDoc = async (
  db: DatabaseReader,
  sessionId: Id<'speakingSessions'>,
): Promise<Doc<'speakingSessionRuntime'> | null> => {
  const runtime = await db
    .query('speakingSessionRuntime')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .order('desc')
    .take(1)
  return runtime[0] ?? null
}

const recordUsageMutation = makeFunctionReference<
  'mutation',
  { sessionId: Id<'speakingSessions'>; deltaMs: number },
  { usageMs: number; limitMs: number; status: string }
>('speaking:recordUsage')

const processSessionInsightsMutation = makeFunctionReference<
  'mutation',
  { sessionId: Id<'speakingSessions'> },
  { inserted?: number; skipped?: string }
>('learningInsights:processSessionInsights')

export const startSession = mutation({
  args: {
    mode: v.optional(v.union(v.literal('demo'), v.literal('standard'))),
    demoId: v.optional(v.string()),
    targetLanguage: v.string(),
    sourceLanguage: v.optional(v.string()),
    limitMs: v.optional(v.number()),
    turnId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    const mode = args.mode ?? (userId ? 'standard' : 'demo')

    if (mode === 'standard' && !userId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required for standard sessions.',
      })
    }

    if (mode === 'demo' && !args.demoId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'demoId is required for demo sessions.',
      })
    }

    const now = Date.now()
    const demoLimitMs = resolveDemoSessionLimitMs(args.limitMs)
    let limitMs = mode === 'demo' ? demoLimitMs : 0

    const demoId = args.demoId
    if (mode === 'demo') {
      const resolvedDemoId = demoId as string
      const existingUsage = await ctx.db
        .query('demoUsage')
        .withIndex('by_demo', (q) => q.eq('demoId', resolvedDemoId))
        .unique()
      if (demoLimitMs > 0) {
        const totalMs = existingUsage?.totalMs ?? 0

        if (totalMs >= demoLimitMs) {
          throw new ConvexError({
            code: 'DEMO_LIMIT',
            message: 'Demo limit reached.',
          })
        }

        limitMs = Math.max(demoLimitMs - totalMs, 0)

        if (!existingUsage) {
          await ctx.db.insert('demoUsage', {
            demoId: resolvedDemoId,
            totalMs,
            limitMs: demoLimitMs,
            createdAt: now,
            updatedAt: now,
          })
        } else if (existingUsage.limitMs !== demoLimitMs) {
          await ctx.db.patch(existingUsage._id, {
            limitMs: demoLimitMs,
            updatedAt: now,
          })
        }
      } else {
        limitMs = 0
      }
    }

    if (mode === 'standard' && userId) {
      const dayStart = getUtcDayStart(now)
      const usage = await ctx.db
        .query('speakingDailyUsage')
        .withIndex('by_user_day', (q) =>
          q.eq('userId', userId).eq('dayStart', dayStart),
        )
        .unique()
      const totalMs = usage?.totalMs ?? 0
      if (totalMs >= AUTH_DAILY_LIMIT_MS) {
        throw new ConvexError({
          code: 'DAILY_LIMIT',
          message: 'Daily usage limit reached.',
        })
      }
      limitMs = Math.max(AUTH_DAILY_LIMIT_MS - totalMs, 0)

      if (!usage) {
        await ctx.db.insert('speakingDailyUsage', {
          userId,
          dayStart,
          totalMs,
          limitMs: AUTH_DAILY_LIMIT_MS,
          createdAt: now,
          updatedAt: now,
        })
      } else if (usage.limitMs !== AUTH_DAILY_LIMIT_MS) {
        await ctx.db.patch(usage._id, {
          limitMs: AUTH_DAILY_LIMIT_MS,
          updatedAt: now,
        })
      }
    }

    const sessionId = await ctx.db.insert('speakingSessions', {
      userId: userId ?? undefined,
      demoId: mode === 'demo' ? demoId : undefined,
      mode,
      status: 'active',
      activeTurnId: args.turnId,
      targetLanguage: args.targetLanguage,
      sourceLanguage: args.sourceLanguage,
      createdAt: now,
      updatedAt: now,
      usageMs: 0,
      limitMs,
      pauseCount: 0,
    })

    await ctx.db.insert('speakingSessionUsage', {
      sessionId,
      usageMs: 0,
    })

    await ctx.db.insert('speakingSessionRuntime', {
      sessionId,
      activeTurnId: args.turnId,
    })

    return {
      sessionId,
      mode,
      limitMs,
      usageMs: 0,
    }
  },
})

export const endSession = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    terminationReason: v.optional(sessionTerminationReasonValidator),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const now = Date.now()
    const resolved = resolveEndSessionState({
      status: session.status,
      requestedReason: args.terminationReason,
    })
    const status = resolved.status
    const terminationReason: SessionTerminationReason =
      resolved.terminationReason

    await ctx.db.patch(session._id, {
      status,
      terminationReason,
      endedAt: now,
      updatedAt: now,
    })

    try {
      await ctx.runMutation(processSessionInsightsMutation, {
        sessionId: args.sessionId,
      })
    } catch (err) {
      console.error('Failed to process session insights', err)
    }

    return { status }
  },
})

export const pauseSession = mutation({
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

    if (session.status !== 'active') {
      return { status: session.status }
    }

    const now = Date.now()
    await ctx.db.patch(session._id, {
      status: 'paused',
      pausedAt: now,
      updatedAt: now,
      pauseCount: (session.pauseCount ?? 0) + 1,
    })

    return { status: 'paused' }
  },
})

export const resumeSession = mutation({
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

    if (session.status !== 'paused') {
      return { status: session.status }
    }

    const now = Date.now()
    await ctx.db.patch(session._id, {
      status: 'active',
      lastResumedAt: now,
      updatedAt: now,
    })

    return { status: 'active' }
  },
})

export const setActiveTurnId = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    turnId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    if (session.status !== 'active') {
      return
    }

    const runtime = await getLatestRuntimeDoc(ctx.db, args.sessionId)
    if (!runtime) {
      await ctx.db.insert('speakingSessionRuntime', {
        sessionId: args.sessionId,
        activeTurnId: args.turnId,
      })
      return
    }

    if (runtime.activeTurnId === args.turnId) {
      return
    }

    await ctx.db.patch(runtime._id, {
      activeTurnId: args.turnId,
    })
  },
})

export const recordUsage = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    deltaMs: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const usageDoc = await getLatestUsageDoc(ctx.db, args.sessionId)
    const usageMs = usageDoc?.usageMs ?? session.usageMs

    if (session.status !== 'active') {
      return {
        usageMs,
        limitMs: session.limitMs,
        status: session.status,
      }
    }

    const deltaMs = clampDeltaMs(args.deltaMs)
    if (!deltaMs) {
      return {
        usageMs,
        limitMs: session.limitMs,
        status: session.status,
      }
    }

    const resolvedTransition = resolveUsageTransition({
      usageMs,
      deltaMs,
      limitMs: session.limitMs,
      status: session.status,
    })
    const nextUsage = resolvedTransition.nextUsage
    const nextStatus = resolvedTransition.nextStatus
    const terminationReason =
      resolvedTransition.terminationReason ??
      (nextStatus === 'limit_reached' ? 'limit_reached' : null)
    const now = Date.now()

    if (!usageDoc) {
      await ctx.db.insert('speakingSessionUsage', {
        sessionId: args.sessionId,
        usageMs: nextUsage,
        lastChunkAt: now,
      })
    } else {
      await ctx.db.patch(usageDoc._id, {
        usageMs: nextUsage,
        lastChunkAt: now,
      })
    }

    if (terminationReason) {
      await ctx.db.patch(session._id, {
        status: nextStatus,
        terminationReason,
      })
    }

    const demoId = session.demoId
    if (session.mode === 'demo' && demoId) {
      const usage = await ctx.db
        .query('demoUsage')
        .withIndex('by_demo', (q) => q.eq('demoId', demoId))
        .unique()

      if (usage) {
        const nextTotal = Math.min(usage.totalMs + deltaMs, usage.limitMs)
        await ctx.db.patch(usage._id, {
          totalMs: nextTotal,
          updatedAt: now,
        })
      }
    }

    if (session.mode === 'standard' && session.userId) {
      const userId = session.userId
      const dayStart = getUtcDayStart(now)
      const usage = await ctx.db
        .query('speakingDailyUsage')
        .withIndex('by_user_day', (q) =>
          q.eq('userId', userId).eq('dayStart', dayStart),
        )
        .unique()
      const nextTotal = Math.min(
        (usage?.totalMs ?? 0) + deltaMs,
        AUTH_DAILY_LIMIT_MS,
      )

      if (!usage) {
        await ctx.db.insert('speakingDailyUsage', {
          userId,
          dayStart,
          totalMs: nextTotal,
          limitMs: AUTH_DAILY_LIMIT_MS,
          createdAt: now,
          updatedAt: now,
        })
      } else {
        await ctx.db.patch(usage._id, {
          totalMs: nextTotal,
          updatedAt: now,
        })
      }
    }

    return {
      usageMs: nextUsage,
      limitMs: session.limitMs,
      status: nextStatus,
    }
  },
})

export const appendEvent = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    type: v.union(
      v.literal('transcript'),
      v.literal('correction'),
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
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const now = Date.now()

    const eventId = await ctx.db.insert('speakingEvents', {
      sessionId: args.sessionId,
      type: args.type,
      provider: args.provider,
      speaker: args.speaker,
      text: args.text,
      turnId: args.turnId,
      streamId: args.streamId,
      streamStatus: args.streamStatus,
      title: args.title,
      detail: args.detail,
      severity: args.severity,
      payload: args.payload,
      createdAt: now,
    })

    return { eventId }
  },
})

export const upsertUserTranscript = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    eventId: v.optional(v.id('speakingEvents')),
    text: v.string(),
    provider: v.optional(v.string()),
    turnId: v.optional(v.string()),
    speaker: v.optional(v.union(v.literal('user'), v.literal('teacher'))),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    const now = Date.now()

    if (args.eventId) {
      const event = await ctx.db.get(args.eventId)
      if (!event || event.sessionId !== args.sessionId) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Transcript event not found.',
        })
      }

      await ctx.db.patch(event._id, {
        text: args.text,
      })
      if (!event.turnId && args.turnId) {
        await ctx.db.patch(event._id, {
          turnId: args.turnId,
        })
      }
      return { eventId: event._id }
    }

    const eventId = await ctx.db.insert('speakingEvents', {
      sessionId: args.sessionId,
      type: 'transcript',
      provider: args.provider,
      speaker: args.speaker ?? 'user',
      text: args.text,
      turnId: args.turnId,
      createdAt: now,
    })

    return { eventId }
  },
})

export const startCoachReplyStream = mutation({
  args: {
    sessionId: v.id('speakingSessions'),
    turnId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session not found.',
      })
    }

    if (session.status !== 'active') {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Session is not active.',
      })
    }

    const runtime = await getLatestRuntimeDoc(ctx.db, args.sessionId)
    if (!runtime) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Session runtime not found.',
      })
    }

    if (runtime.activeTurnId && runtime.activeTurnId !== args.turnId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Session turn has advanced.',
      })
    }

    if (!runtime.activeTurnId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Session turn is not set.',
      })
    }

    const streamId = await streamingComponent.createStream(ctx)

    const now = Date.now()
    const eventId = await ctx.db.insert('speakingEvents', {
      sessionId: args.sessionId,
      type: 'transcript',
      provider: 'coach',
      speaker: 'coach',
      text: '',
      turnId: args.turnId,
      streamId,
      streamStatus: 'streaming',
      createdAt: now,
    })

    return { streamId, eventId }
  },
})

export const cancelCoachReplyStream = mutation({
  args: {
    eventId: v.id('speakingEvents'),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId)
    if (!event) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Event not found.',
      })
    }

    if (event.streamStatus === 'canceled') {
      return
    }

    await ctx.db.patch(event._id, {
      streamStatus: 'canceled',
    })
  },
})

export const getSession = query({
  args: {
    sessionId: v.id('speakingSessions'),
  },
  handler: async (ctx, args) => ctx.db.get(args.sessionId),
})

export const getSessionUsage = query({
  args: {
    sessionId: v.id('speakingSessions'),
  },
  handler: async (ctx, args) => {
    const usage = await getLatestUsageDoc(ctx.db, args.sessionId)
    return {
      usageMs: usage?.usageMs ?? 0,
      lastChunkAt: usage?.lastChunkAt ?? null,
    }
  },
})

export const getSessionUsageBatch = query({
  args: {
    sessionIds: v.array(v.id('speakingSessions')),
  },
  handler: async (ctx, args) => {
    const result: Record<
      string,
      { usageMs: number; lastChunkAt: number | null }
    > = {}
    for (const sessionId of args.sessionIds) {
      const usage = await getLatestUsageDoc(ctx.db, sessionId)
      result[sessionId] = {
        usageMs: usage?.usageMs ?? 0,
        lastChunkAt: usage?.lastChunkAt ?? null,
      }
    }
    return result
  },
})

export const getSessionRuntime = query({
  args: {
    sessionId: v.id('speakingSessions'),
  },
  handler: async (ctx, args) => {
    const runtime = await getLatestRuntimeDoc(ctx.db, args.sessionId)
    return {
      activeTurnId: runtime?.activeTurnId ?? null,
    }
  },
})

export const backfillSpeakingSessionState = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 200, 500)
    const { page, continueCursor, isDone } = await ctx.db
      .query('speakingSessions')
      .order('asc')
      .paginate({ numItems: limit, cursor: args.cursor ?? null })

    let createdUsage = 0
    let createdRuntime = 0

    for (const session of page) {
      const usage = await getLatestUsageDoc(ctx.db, session._id)
      if (!usage) {
        await ctx.db.insert('speakingSessionUsage', {
          sessionId: session._id,
          usageMs: session.usageMs,
          lastChunkAt: session.lastChunkAt,
        })
        createdUsage += 1
      }

      const runtime = await getLatestRuntimeDoc(ctx.db, session._id)
      if (!runtime) {
        await ctx.db.insert('speakingSessionRuntime', {
          sessionId: session._id,
          activeTurnId: session.activeTurnId,
        })
        createdRuntime += 1
      }
    }

    return {
      processed: page.length,
      createdUsage,
      createdRuntime,
      cursor: continueCursor,
      isDone,
    }
  },
})

export const getDailyUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return null
    }

    const now = Date.now()
    const dayStart = getUtcDayStart(now)
    const usage = await ctx.db
      .query('speakingDailyUsage')
      .withIndex('by_user_day', (q) =>
        q.eq('userId', userId).eq('dayStart', dayStart),
      )
      .unique()

    const totalMs = usage?.totalMs ?? 0
    const limitMs = usage?.limitMs ?? AUTH_DAILY_LIMIT_MS

    return {
      dayStart,
      totalMs,
      limitMs,
      remainingMs: Math.max(limitMs - totalMs, 0),
    }
  },
})

export const listRecentSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    const limit = Math.min(args.limit ?? 12, 40)
    const cutoff = Date.now() - HISTORY_RETENTION_MS

    const sessions = await ctx.db
      .query('speakingSessions')
      .withIndex('by_user_createdAt', (q) =>
        q.eq('userId', userId).gte('createdAt', cutoff),
      )
      .order('desc')
      .take(limit)

    return sessions.map((session) => ({
      _id: session._id,
      createdAt: session.createdAt,
      endedAt: session.endedAt ?? null,
      targetLanguage: session.targetLanguage,
      sourceLanguage: session.sourceLanguage ?? null,
      status: session.status,
      limitMs: session.limitMs,
      terminationReason: session.terminationReason ?? null,
    }))
  },
})

export const getSessionTranscript = query({
  args: {
    sessionId: v.id('speakingSessions'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwnedSession(ctx, args.sessionId)

    const limit = Math.min(args.limit ?? 200, 500)
    const events = await ctx.db
      .query('speakingEvents')
      .withIndex('by_session_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('asc')
      .take(limit)

    const entries: Array<{
      createdAt: number
      transcript: {
        _id: Id<'speakingEvents'>
        speaker: Doc<'speakingEvents'>['speaker'] | null
        text: string
        translatedText: string | null
      }
      corrections: Array<{
        _id: Id<'speakingEvents'>
        title: string
        detail: string
        severity: Doc<'speakingEvents'>['severity'] | null
      }>
      vocabulary: Array<{
        _id: Id<'speakingEvents'>
        word: string
        definition: string
      }>
    }> = []

    const transcriptIndex = new Map<
      Id<'speakingEvents'>,
      (typeof entries)[number]
    >()

    for (const event of events) {
      if (event.type !== 'transcript') {
        continue
      }

      const entry = {
        createdAt: event.createdAt,
        transcript: {
          _id: event._id,
          speaker: event.speaker ?? null,
          text: event.text ?? '',
          translatedText: event.translatedText ?? null,
        },
        corrections: [],
        vocabulary: [],
      }
      entries.push(entry)
      transcriptIndex.set(event._id, entry)
    }

    for (const event of events) {
      if (event.type !== 'correction') {
        continue
      }
      const refId = event.referenceEventId
      if (!refId) {
        continue
      }
      const entry = transcriptIndex.get(refId)
      if (!entry) {
        continue
      }
      entry.corrections.push({
        _id: event._id,
        title: event.title ?? 'Correction',
        detail: event.detail ?? event.text ?? '',
        severity: event.severity ?? null,
      })
    }

    for (const event of events) {
      if (event.type !== 'vocabulary') {
        continue
      }
      const refId = event.referenceEventId
      if (!refId) {
        continue
      }
      const entry = transcriptIndex.get(refId)
      if (!entry) {
        continue
      }
      const word = event.text ?? ''
      const definition = event.detail ?? ''
      if (!word || !definition) {
        continue
      }
      entry.vocabulary.push({
        _id: event._id,
        word,
        definition,
      })
    }

    return entries
  },
})

export const getSessionFeed = query({
  args: {
    sessionId: v.id('speakingSessions'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 60, 200)
    return ctx.db
      .query('speakingEvents')
      .withIndex('by_session_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('asc')
      .take(limit)
  },
})

export const getCoachHistory = internalQuery({
  args: {
    sessionId: v.id('speakingSessions'),
    excludeStreamId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 24, 80)
    const events = await ctx.db
      .query('speakingEvents')
      .withIndex('by_session_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('desc')
      .take(limit * 3)

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const event of events.reverse()) {
      if (
        event.type !== 'transcript' ||
        !event.speaker ||
        event.streamStatus === 'canceled' ||
        (args.excludeStreamId && event.streamId === args.excludeStreamId)
      ) {
        continue
      }

      const trimmed = (event.text ?? '').trim()
      if (!trimmed) {
        continue
      }

      if (event.speaker === 'user') {
        messages.push({ role: 'user', content: trimmed })
      } else if (event.speaker === 'coach') {
        messages.push({ role: 'assistant', content: trimmed })
      }
    }

    return messages.slice(-limit)
  },
})

export const getEventByStream = internalQuery({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query('speakingEvents')
      .withIndex('by_stream', (q) => q.eq('streamId', args.streamId))
      .unique(),
})

export const getEventById = internalQuery({
  args: {
    eventId: v.id('speakingEvents'),
  },
  handler: async (ctx, args) => ctx.db.get(args.eventId),
})

export const getUserTranscriptByTurn = internalQuery({
  args: {
    sessionId: v.id('speakingSessions'),
    turnId: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query('speakingEvents')
      .withIndex('by_session_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('desc')
      .take(120)

    return (
      events.find(
        (event) =>
          event.type === 'transcript' &&
          event.speaker === 'user' &&
          event.turnId === args.turnId,
      ) ?? null
    )
  },
})

export const updateStreamEvent = internalMutation({
  args: {
    eventId: v.id('speakingEvents'),
    text: v.optional(v.string()),
    streamStatus: v.optional(
      v.union(
        v.literal('streaming'),
        v.literal('done'),
        v.literal('error'),
        v.literal('canceled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId)
    if (!event) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Event not found.',
      })
    }

    if (event.streamStatus === 'canceled') {
      return
    }

    await ctx.db.patch(event._id, {
      text: args.text ?? event.text,
      streamStatus: args.streamStatus ?? event.streamStatus,
    })
  },
})

export const saveEventTranslation = mutation({
  args: {
    eventId: v.id('speakingEvents'),
    translatedText: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId)
    if (!event || event.type !== 'transcript') {
      return
    }

    const session = await ctx.db.get(event.sessionId)
    if (!session) {
      return
    }

    if (session.mode === 'standard') {
      const userId = await getAuthUserId(ctx)
      if (session.userId !== userId) {
        return
      }
    }

    await ctx.db.patch(args.eventId, {
      translatedText: args.translatedText,
    })
  },
})

export const ingestAudioChunk = action({
  args: {
    sessionId: v.id('speakingSessions'),
    chunkMs: v.number(),
    audio: v.optional(v.bytes()),
  },
  handler: async (ctx, args) => {
    const deltaMs = clampDeltaMs(args.chunkMs)

    return ctx.runMutation(recordUsageMutation, {
      sessionId: args.sessionId,
      deltaMs,
    })
  },
})
