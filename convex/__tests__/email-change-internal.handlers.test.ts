// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUserIdMock = vi.fn()
const beginMock = vi.fn()
const resendMock = vi.fn()
const verifyMock = vi.fn()

vi.mock('../_generated/server', () => ({
  internalMutation: (definition: unknown) => definition,
}))

vi.mock('../lib/requireUserId', () => ({
  requireUserId: (...args: Array<unknown>) => requireUserIdMock(...args),
}))

vi.mock('../lib/emailChangeAdapters', async () => {
  const actual = await vi.importActual('../lib/emailChangeAdapters')
  return {
    ...actual,
    createConvexEmailChangeStore: () => ({ store: true }),
    createPasswordAccountPort: () => ({ port: true }),
  }
})

vi.mock('ts-common/convex/email-change-service', async () => {
  const actual = await vi.importActual('ts-common/convex/email-change-service')
  return {
    ...actual,
    createEmailChangeService: () => ({
      beginRequestForUser: (...args: Array<unknown>) => beginMock(...args),
      resendRequestForUser: (...args: Array<unknown>) => resendMock(...args),
      verifyTokenHash: (...args: Array<unknown>) => verifyMock(...args),
    }),
  }
})

describe('glotcap emailChangeInternal handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserIdMock.mockResolvedValue('user_1')
    beginMock.mockResolvedValue({ newEmail: 'n@example.com', expiresAt: 123 })
    resendMock.mockResolvedValue({
      newEmail: 'n@example.com',
      expiresAt: 456,
      resendCount: 1,
    })
    verifyMock.mockResolvedValue({
      status: 'verified',
      newEmail: 'n@example.com',
    })
  })

  it('routes begin request to service', async () => {
    const module = (await import('../emailChangeInternal')) as any
    const result = await module.beginEmailChangeRequest.handler(
      { db: {} } as never,
      {
        newEmail: 'n@example.com',
        tokenHash: 'h',
        now: 1,
        expiresAt: 2,
      },
    )

    expect(beginMock).toHaveBeenCalledWith('user_1', {
      newEmailInput: 'n@example.com',
      tokenHash: 'h',
      nowMs: 1,
      expiresAt: 2,
    })
    expect(result).toEqual({ newEmail: 'n@example.com', expiresAt: 123 })
  })

  it('routes resend to service', async () => {
    const module = (await import('../emailChangeInternal')) as any
    const result = await module.resendEmailChangeRequest.handler(
      { db: {} } as never,
      {
        tokenHash: 'h2',
        now: 3,
        expiresAt: 4,
      },
    )

    expect(resendMock).toHaveBeenCalledWith('user_1', {
      tokenHash: 'h2',
      nowMs: 3,
      expiresAt: 4,
    })
    expect(result).toEqual({
      newEmail: 'n@example.com',
      expiresAt: 456,
      resendCount: 1,
    })
  })

  it('routes verify to service', async () => {
    const module = (await import('../emailChangeInternal')) as any
    const result = await module.verifyEmailChangeToken.handler(
      { db: {} } as never,
      {
        tokenHash: 'hv',
        now: 5,
      },
    )

    expect(verifyMock).toHaveBeenCalledWith({
      tokenHash: 'hv',
      nowMs: 5,
    })
    expect(result).toEqual({ status: 'verified', newEmail: 'n@example.com' })
  })

  it('throws unauthorized when user missing', async () => {
    const module = (await import('../emailChangeInternal')) as any
    requireUserIdMock.mockRejectedValueOnce(
      new Error('Authentication required.'),
    )

    await expect(
      module.beginEmailChangeRequest.handler({ db: {} } as never, {
        newEmail: 'x@example.com',
        tokenHash: 'h',
        now: 1,
        expiresAt: 2,
      }),
    ).rejects.toThrow()
  })

  it('throws unauthorized for resend when user missing', async () => {
    const module = (await import('../emailChangeInternal')) as any
    requireUserIdMock.mockRejectedValueOnce(
      new Error('Authentication required.'),
    )

    await expect(
      module.resendEmailChangeRequest.handler({ db: {} } as never, {
        tokenHash: 'h',
        now: 3,
        expiresAt: 4,
      }),
    ).rejects.toThrow()
  })
})
