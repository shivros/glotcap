import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { endSession, recordUsage } from '../speaking'

type SessionDoc = {
  _id: string
  status: 'active' | 'paused' | 'ended' | 'limit_reached'
  limitMs: number
  usageMs: number
  mode: 'demo' | 'standard'
  demoId?: string
  userId?: string
}

type UsageDoc = {
  _id: string
  sessionId: string
  usageMs: number
  lastChunkAt?: number
}

type DemoUsageDoc = {
  _id: string
  demoId: string
  totalMs: number
  limitMs: number
  updatedAt: number
}

type DailyUsageDoc = {
  _id: string
  userId: string
  dayStart: number
  totalMs: number
  limitMs: number
  createdAt: number
  updatedAt: number
}

const dayStartUtc = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const createCtx = (seed?: {
  session?: SessionDoc
  usage?: UsageDoc
  demoUsage?: DemoUsageDoc
  dailyUsage?: DailyUsageDoc
  runMutationError?: Error
}) => {
  const session = seed?.session ?? null
  const usageBySession = new Map<string, UsageDoc>()
  const usageById = new Map<string, UsageDoc>()
  if (seed?.usage) {
    usageBySession.set(seed.usage.sessionId, seed.usage)
    usageById.set(seed.usage._id, seed.usage)
  }

  const demoUsageByDemoId = new Map<string, DemoUsageDoc>()
  const demoUsageById = new Map<string, DemoUsageDoc>()
  if (seed?.demoUsage) {
    demoUsageByDemoId.set(seed.demoUsage.demoId, seed.demoUsage)
    demoUsageById.set(seed.demoUsage._id, seed.demoUsage)
  }

  const dailyUsageByKey = new Map<string, DailyUsageDoc>()
  const dailyUsageById = new Map<string, DailyUsageDoc>()
  if (seed?.dailyUsage) {
    const key = `${seed.dailyUsage.userId}:${seed.dailyUsage.dayStart}`
    dailyUsageByKey.set(key, seed.dailyUsage)
    dailyUsageById.set(seed.dailyUsage._id, seed.dailyUsage)
  }

  const patches: Array<{ id: string; patch: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = []

  const db = {
    get: (id: string) => {
      if (session?._id === id) {
        return Promise.resolve(session)
      }
      return Promise.resolve(null)
    },
    query: (table: string) => {
      if (table === 'speakingSessionUsage') {
        return {
          withIndex: (_name: string, matcher: (q: any) => any) => {
            const state = { sessionId: '' }
            matcher({
              eq: (_field: string, value: string) => {
                state.sessionId = value
                return state
              },
            })
            return {
              order: () => ({
                take: (_limit: number) =>
                  Promise.resolve(
                    usageBySession.get(state.sessionId)
                      ? [usageBySession.get(state.sessionId)]
                      : [],
                  ),
              }),
            }
          },
        }
      }

      if (table === 'demoUsage') {
        return {
          withIndex: (_name: string, matcher: (q: any) => any) => {
            const state = { demoId: '' }
            matcher({
              eq: (_field: string, value: string) => {
                state.demoId = value
                return state
              },
            })
            return {
              unique: () =>
                Promise.resolve(demoUsageByDemoId.get(state.demoId) ?? null),
            }
          },
        }
      }

      if (table === 'speakingDailyUsage') {
        return {
          withIndex: (_name: string, matcher: (q: any) => any) => {
            const state = { userId: '', dayStart: 0 }
            matcher({
              eq: (_field: string, value: string) => ({
                eq: (_nextField: string, nextValue: number) => {
                  state.userId = value
                  state.dayStart = nextValue
                  return state
                },
              }),
            })
            return {
              unique: () =>
                Promise.resolve(
                  dailyUsageByKey.get(`${state.userId}:${state.dayStart}`) ??
                    null,
                ),
            }
          },
        }
      }

      throw new Error(`Unexpected table query: ${table}`)
    },
    patch: (id: string, patch: Record<string, unknown>) => {
      patches.push({ id, patch })
      if (session?._id === id) {
        Object.assign(session, patch)
      }
      const usage = usageById.get(id)
      if (usage) {
        Object.assign(usage, patch)
      }
      const demoUsage = demoUsageById.get(id)
      if (demoUsage) {
        Object.assign(demoUsage, patch)
      }
      const dailyUsage = dailyUsageById.get(id)
      if (dailyUsage) {
        Object.assign(dailyUsage, patch)
      }
      return Promise.resolve()
    },
    insert: (table: string, value: Record<string, unknown>) => {
      inserts.push({ table, value })
      if (table === 'speakingSessionUsage') {
        const doc: UsageDoc = {
          _id: `usage-${inserts.length}`,
          sessionId: String(value.sessionId),
          usageMs: Number(value.usageMs),
          lastChunkAt:
            typeof value.lastChunkAt === 'number'
              ? value.lastChunkAt
              : undefined,
        }
        usageBySession.set(doc.sessionId, doc)
        usageById.set(doc._id, doc)
      }
      if (table === 'speakingDailyUsage') {
        const doc: DailyUsageDoc = {
          _id: `daily-${inserts.length}`,
          userId: String(value.userId),
          dayStart: Number(value.dayStart),
          totalMs: Number(value.totalMs),
          limitMs: Number(value.limitMs),
          createdAt: Number(value.createdAt),
          updatedAt: Number(value.updatedAt),
        }
        dailyUsageByKey.set(`${doc.userId}:${doc.dayStart}`, doc)
        dailyUsageById.set(doc._id, doc)
      }
      return Promise.resolve(`insert-${inserts.length}`)
    },
  }

  const runMutation = vi.fn(() => {
    if (seed?.runMutationError) {
      return Promise.reject(seed.runMutationError)
    }
    return Promise.resolve({ inserted: 1 })
  })

  return {
    ctx: {
      db,
      runMutation,
    },
    patches,
    inserts,
  }
}

describe('speaking functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('endSession stores provided termination reason for non-limit sessions', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    const { ctx, patches } = createCtx({
      session: {
        _id: 'session-1',
        status: 'active',
        limitMs: 0,
        usageMs: 0,
        mode: 'standard',
      },
    })

    const result = await (endSession as any)._handler(ctx, {
      sessionId: 'session-1',
      terminationReason: 'error',
    })

    expect(result).toEqual({ status: 'ended' })
    expect(patches).toContainEqual({
      id: 'session-1',
      patch: {
        status: 'ended',
        terminationReason: 'error',
        endedAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    })
  })

  it('endSession keeps limit_reached reason when session already hit limit', async () => {
    const { ctx, patches } = createCtx({
      session: {
        _id: 'session-limit',
        status: 'limit_reached',
        limitMs: 300000,
        usageMs: 300000,
        mode: 'demo',
        demoId: 'demo-1',
      },
    })

    const result = await (endSession as any)._handler(ctx, {
      sessionId: 'session-limit',
      terminationReason: 'manual',
    })

    expect(result).toEqual({ status: 'limit_reached' })
    expect(
      patches.some(
        (entry) => entry.patch.terminationReason === 'limit_reached',
      ),
    ).toBe(true)
  })

  it('recordUsage marks limit_reached with termination reason when crossing limit', async () => {
    const { ctx, patches } = createCtx({
      session: {
        _id: 'session-usage',
        status: 'active',
        limitMs: 1000,
        usageMs: 0,
        mode: 'demo',
        demoId: 'demo-1',
      },
      usage: {
        _id: 'usage-1',
        sessionId: 'session-usage',
        usageMs: 900,
      },
    })

    const result = await (recordUsage as any)._handler(ctx, {
      sessionId: 'session-usage',
      deltaMs: 200,
    })

    expect(result).toMatchObject({
      usageMs: 1100,
      limitMs: 1000,
      status: 'limit_reached',
    })
    expect(patches).toContainEqual({
      id: 'session-usage',
      patch: {
        status: 'limit_reached',
        terminationReason: 'limit_reached',
      },
    })
  })

  it('recordUsage returns existing status without writes when session is not active', async () => {
    const { ctx, patches } = createCtx({
      session: {
        _id: 'session-paused',
        status: 'paused',
        limitMs: 1000,
        usageMs: 500,
        mode: 'standard',
        userId: 'user-1',
      },
      usage: {
        _id: 'usage-2',
        sessionId: 'session-paused',
        usageMs: 500,
      },
    })

    const result = await (recordUsage as any)._handler(ctx, {
      sessionId: 'session-paused',
      deltaMs: 200,
    })

    expect(result).toEqual({
      usageMs: 500,
      limitMs: 1000,
      status: 'paused',
    })
    expect(patches).toHaveLength(0)
  })

  it('recordUsage inserts daily usage row for first active standard session chunk', async () => {
    const now = 1700000000000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const { ctx, inserts } = createCtx({
      session: {
        _id: 'session-standard',
        status: 'active',
        limitMs: 5000,
        usageMs: 0,
        mode: 'standard',
        userId: 'user-42',
      },
    })

    await (recordUsage as any)._handler(ctx, {
      sessionId: 'session-standard',
      deltaMs: 500,
    })

    expect(
      inserts.some(
        (entry) =>
          entry.table === 'speakingDailyUsage' &&
          entry.value.userId === 'user-42' &&
          entry.value.dayStart === dayStartUtc(now) &&
          entry.value.totalMs === 500,
      ),
    ).toBe(true)
  })

  it('throws NOT_FOUND when ending a missing session', async () => {
    const { ctx } = createCtx()

    await expect(
      (endSession as any)._handler(ctx, {
        sessionId: 'missing-session',
      }),
    ).rejects.toBeInstanceOf(ConvexError)
  })
})
