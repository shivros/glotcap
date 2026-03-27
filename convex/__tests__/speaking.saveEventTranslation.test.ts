import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthUserId } from '@convex-dev/auth/server'
import { saveEventTranslation } from '../speaking'

vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: vi.fn(),
}))

vi.mock('../_generated/server', () => ({
  mutation: (opts: any) => {
    const fn = opts.handler
    fn._handler = opts.handler
    return fn
  },
  query: (opts: any) => opts,
  action: (opts: any) => opts,
  internalMutation: (opts: any) => opts,
  internalQuery: (opts: any) => opts,
}))

vi.mock('../streaming', () => ({
  streamingComponent: {
    stream: () => ({}),
  },
}))

const mockGetAuthUserId = vi.mocked(getAuthUserId)

type EventDoc = {
  _id: string
  type: string
  sessionId: string
  [key: string]: unknown
}

type SessionDoc = {
  _id: string
  mode: 'demo' | 'standard'
  userId?: string
  [key: string]: unknown
}

const createCtx = (seed?: { event?: EventDoc; session?: SessionDoc }) => {
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = []

  const db = {
    get: (id: string) => {
      if (seed?.event?._id === id) return Promise.resolve(seed.event)
      if (seed?.session?._id === id) return Promise.resolve(seed.session)
      return Promise.resolve(null)
    },
    patch: (id: string, patch: Record<string, unknown>) => {
      patches.push({ id, patch })
      return Promise.resolve()
    },
  }

  return { ctx: { db } as any, patches }
}

describe('saveEventTranslation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('patches translatedText on a valid transcript event', async () => {
    mockGetAuthUserId.mockResolvedValue('user-1' as any)
    const { ctx, patches } = createCtx({
      event: {
        _id: 'event-1',
        type: 'transcript',
        sessionId: 'session-1',
      },
      session: {
        _id: 'session-1',
        mode: 'standard',
        userId: 'user-1',
      },
    })

    await (saveEventTranslation as any)(ctx, {
      eventId: 'event-1',
      translatedText: 'Hello',
    })

    expect(patches).toEqual([
      { id: 'event-1', patch: { translatedText: 'Hello' } },
    ])
  })

  it('silently returns when event does not exist', async () => {
    const { ctx, patches } = createCtx()

    await (saveEventTranslation as any)(ctx, {
      eventId: 'missing',
      translatedText: 'Hello',
    })

    expect(patches).toHaveLength(0)
  })

  it('silently returns when event is not a transcript', async () => {
    const { ctx, patches } = createCtx({
      event: {
        _id: 'event-1',
        type: 'correction',
        sessionId: 'session-1',
      },
      session: {
        _id: 'session-1',
        mode: 'demo',
      },
    })

    await (saveEventTranslation as any)(ctx, {
      eventId: 'event-1',
      translatedText: 'Hello',
    })

    expect(patches).toHaveLength(0)
  })

  it('silently returns when session does not exist', async () => {
    const { ctx, patches } = createCtx({
      event: {
        _id: 'event-1',
        type: 'transcript',
        sessionId: 'session-gone',
      },
    })

    await (saveEventTranslation as any)(ctx, {
      eventId: 'event-1',
      translatedText: 'Hello',
    })

    expect(patches).toHaveLength(0)
  })

  it('silently returns when standard session belongs to another user', async () => {
    mockGetAuthUserId.mockResolvedValue('user-other' as any)
    const { ctx, patches } = createCtx({
      event: {
        _id: 'event-1',
        type: 'transcript',
        sessionId: 'session-1',
      },
      session: {
        _id: 'session-1',
        mode: 'standard',
        userId: 'user-1',
      },
    })

    await (saveEventTranslation as any)(ctx, {
      eventId: 'event-1',
      translatedText: 'Hello',
    })

    expect(patches).toHaveLength(0)
  })

  it('allows demo sessions without ownership check', async () => {
    mockGetAuthUserId.mockResolvedValue(null)
    const { ctx, patches } = createCtx({
      event: {
        _id: 'event-1',
        type: 'transcript',
        sessionId: 'session-1',
      },
      session: {
        _id: 'session-1',
        mode: 'demo',
      },
    })

    await (saveEventTranslation as any)(ctx, {
      eventId: 'event-1',
      translatedText: 'Hello',
    })

    expect(patches).toEqual([
      { id: 'event-1', patch: { translatedText: 'Hello' } },
    ])
  })
})
