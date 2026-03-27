// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const beginRequestMock = vi.fn()
const prepareResetMock = vi.fn()

vi.mock('../_generated/server', () => ({
  internalMutation: (definition: unknown) => definition,
}))

vi.mock('../lib/passwordResetAdapters', () => ({
  createPasswordResetMutationService: () => ({
    beginRequest: (...args: Array<unknown>) => beginRequestMock(...args),
    preparePasswordReset: (...args: Array<unknown>) =>
      prepareResetMock(...args),
  }),
}))

describe('passwordResetInternal handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beginRequestMock.mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })
    prepareResetMock.mockResolvedValue({
      status: 'ready',
      providerAccountId: 'password|user@example.com',
      userId: 'user_1',
      requestId: 'request_1',
      email: 'user@example.com',
    })
  })

  it('routes beginPasswordResetRequest to the service', async () => {
    const module = (await import('../passwordResetInternal')) as any
    const result = await module.beginPasswordResetRequest.handler(
      { db: {} } as never,
      {
        email: 'user@example.com',
        tokenHash: 'hash-token',
        now: 100,
        expiresAt: 200,
      },
    )

    expect(beginRequestMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      tokenHash: 'hash-token',
      nowMs: 100,
      expiresAt: 200,
    })
    expect(result).toEqual({ sent: true, email: 'user@example.com' })
  })

  it('routes verifyAndPrepareReset to the service', async () => {
    const module = (await import('../passwordResetInternal')) as any
    const result = await module.verifyAndPrepareReset.handler(
      { db: {} } as never,
      {
        tokenHash: 'hash-token',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
        now: 100,
      },
    )

    expect(prepareResetMock).toHaveBeenCalledWith({
      tokenHash: 'hash-token',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
      nowMs: 100,
    })
    expect(result).toEqual({
      status: 'ready',
      providerAccountId: 'password|user@example.com',
      userId: 'user_1',
      requestId: 'request_1',
      email: 'user@example.com',
    })
  })

  it('marks a request as consumed', async () => {
    const patchMock = vi.fn().mockResolvedValue(undefined)
    const module = (await import('../passwordResetInternal')) as any
    await module.markResetConsumed.handler(
      { db: { patch: patchMock } } as never,
      {
        requestId: 'request_1',
        now: 123,
      },
    )

    expect(patchMock).toHaveBeenCalledWith('request_1', {
      status: 'consumed',
      consumedAt: 123,
      updatedAt: 123,
    })
  })
})
