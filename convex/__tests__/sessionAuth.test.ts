import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { requireAuthUserId, requireOwnedSession } from '../sessionAuth'

vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: vi.fn(),
}))

const mockGetAuthUserId = vi.mocked(getAuthUserId)

const createCtx = () => {
  const docs = new Map<string, Record<string, unknown>>()
  return {
    ctx: {
      db: {
        get: (id: string) => Promise.resolve(docs.get(id) ?? null),
      },
    } as any,
    seed: (id: string, doc: Record<string, unknown>) => {
      docs.set(id, { _id: id, ...doc })
    },
  }
}

describe('requireAuthUserId', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns userId when authenticated', async () => {
    mockGetAuthUserId.mockResolvedValue('user-1' as any)
    const { ctx } = createCtx()

    const result = await requireAuthUserId(ctx)

    expect(result).toBe('user-1')
  })

  it('throws UNAUTHORIZED when not authenticated', async () => {
    mockGetAuthUserId.mockResolvedValue(null)
    const { ctx } = createCtx()

    await expect(requireAuthUserId(ctx)).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ConvexError)) return false
      const data = err.data as { code: string }
      return data.code === 'UNAUTHORIZED'
    })
  })
})

describe('requireOwnedSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns userId and session when caller owns the session', async () => {
    mockGetAuthUserId.mockResolvedValue('user-1' as any)
    const { ctx, seed } = createCtx()
    seed('session-1', { userId: 'user-1', status: 'active' })

    const result = await requireOwnedSession(ctx, 'session-1' as any)

    expect(result.userId).toBe('user-1')
    expect(result.session._id).toBe('session-1')
  })

  it('throws NOT_FOUND when session does not exist', async () => {
    mockGetAuthUserId.mockResolvedValue('user-1' as any)
    const { ctx } = createCtx()

    await expect(requireOwnedSession(ctx, 'missing' as any)).rejects.toSatisfy(
      (err: unknown) => {
        if (!(err instanceof ConvexError)) return false
        const data = err.data as { code: string }
        return data.code === 'NOT_FOUND'
      },
    )
  })

  it('throws NOT_FOUND when session belongs to another user', async () => {
    mockGetAuthUserId.mockResolvedValue('user-1' as any)
    const { ctx, seed } = createCtx()
    seed('session-1', { userId: 'user-2', status: 'active' })

    await expect(
      requireOwnedSession(ctx, 'session-1' as any),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ConvexError)) return false
      const data = err.data as { code: string }
      return data.code === 'NOT_FOUND'
    })
  })

  it('throws UNAUTHORIZED when not authenticated', async () => {
    mockGetAuthUserId.mockResolvedValue(null)
    const { ctx, seed } = createCtx()
    seed('session-1', { userId: 'user-1', status: 'active' })

    await expect(
      requireOwnedSession(ctx, 'session-1' as any),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ConvexError)) return false
      const data = err.data as { code: string }
      return data.code === 'UNAUTHORIZED'
    })
  })
})
