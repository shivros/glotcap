// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireUserIdMock = vi.fn()
const sendEmailMock = vi.fn()
const cancelPendingMock = vi.fn()
const runMutationMock = vi.fn()
const buildTemplateMock = vi.fn()

vi.mock('../_generated/server', () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
  action: (definition: unknown) => definition,
}))

vi.mock('../_generated/api', () => ({
  internal: {
    emailChangeInternal: {
      beginEmailChangeRequest: 'beginEmailChangeRequestRef',
      resendEmailChangeRequest: 'resendEmailChangeRequestRef',
      verifyEmailChangeToken: 'verifyEmailChangeTokenRef',
    },
  },
}))

vi.mock('../lib/requireUserId', () => ({
  requireUserId: (...args: Array<unknown>) => requireUserIdMock(...args),
}))

vi.mock('../emails', () => ({
  resend: {
    sendEmail: (...args: Array<unknown>) => sendEmailMock(...args),
  },
}))

vi.mock('ts-common/convex/email-change', async () => {
  const actual = await vi.importActual('ts-common/convex/email-change')
  return {
    ...actual,
    generateEmailChangeToken: () => 'token123',
    hashEmailChangeToken: (token: string) => Promise.resolve(`hash:${token}`),
    resolveEmailChangeExpiry: (now: number) => now + 1000,
    requireValidAuthEmail: (email: string) => email.trim().toLowerCase(),
  }
})

vi.mock('ts-common/convex/email-change-service', async () => {
  const actual = await vi.importActual('ts-common/convex/email-change-service')
  return {
    ...actual,
    createEmailChangeService: () => ({
      cancelPending: (...args: Array<unknown>) => cancelPendingMock(...args),
    }),
    buildDefaultEmailChangeTemplate: (...args: Array<unknown>) => {
      buildTemplateMock(...args)
      return {
        subject: 'Confirm email',
        html: '<p>Confirm</p>',
        text: 'Confirm',
      }
    },
  }
})

describe('glotcap emailChange handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.SITE_URL = 'https://app.example.com'
    requireUserIdMock.mockResolvedValue('user_1')
    cancelPendingMock.mockResolvedValue({ cancelledCount: 1 })
    runMutationMock.mockResolvedValue({
      newEmail: 'new@example.com',
      expiresAt: 2000,
      resendCount: 1,
      status: 'verified',
    })
  })

  it('returns status payload when no pending request exists', async () => {
    const module = (await import('../emailChange')) as any
    const result = await module.getEmailChangeStatus.handler(
      {
        db: {
          get: () => Promise.resolve({ email: 'USER@Example.com' }),
          query: () => ({
            withIndex: () => ({
              order: () => ({ first: () => Promise.resolve(null) }),
            }),
          }),
        },
      } as never,
      {},
    )

    expect(result).toEqual({
      currentEmail: 'user@example.com',
      pendingChange: null,
    })
  })

  it('delegates cancel mutation to service', async () => {
    const module = (await import('../emailChange')) as any
    const result = await module.cancelEmailChange.handler(
      {
        db: {},
      } as never,
      {},
    )

    expect(cancelPendingMock).toHaveBeenCalledWith('user_1')
    expect(result).toEqual({ cancelledCount: 1 })
  })

  it('requests email change and sends verification email', async () => {
    const module = (await import('../emailChange')) as any
    runMutationMock.mockResolvedValueOnce({
      newEmail: 'new@example.com',
      expiresAt: 5000,
    })

    const result = await module.requestEmailChange.handler(
      {
        runMutation: (...args: Array<unknown>) => runMutationMock(...args),
      } as never,
      { newEmail: 'new@example.com' },
    )

    expect(runMutationMock).toHaveBeenCalledWith(
      'beginEmailChangeRequestRef',
      expect.objectContaining({
        newEmail: 'new@example.com',
        tokenHash: 'hash:token123',
      }),
    )
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'new@example.com',
        subject: 'Confirm email',
      }),
    )
    expect(buildTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationUrl:
          'https://app.example.com/account/email-change/verify?token=token123',
      }),
    )
    expect(result.status).toBe('verification_sent')
  })

  it('resends verification email', async () => {
    const module = (await import('../emailChange')) as any
    runMutationMock.mockResolvedValueOnce({
      newEmail: 'new@example.com',
      expiresAt: 6000,
      resendCount: 2,
    })

    const result = await module.resendEmailChangeVerification.handler(
      {
        runMutation: (...args: Array<unknown>) => runMutationMock(...args),
      } as never,
      {},
    )

    expect(runMutationMock).toHaveBeenCalledWith(
      'resendEmailChangeRequestRef',
      expect.objectContaining({ tokenHash: 'hash:token123' }),
    )
    expect(result.status).toBe('verification_resent')
    expect(result.resendCount).toBe(2)
  })

  it('throws when SITE_URL is missing for request flow', async () => {
    process.env.SITE_URL = ''
    const module = (await import('../emailChange')) as any

    await expect(
      module.requestEmailChange.handler(
        {
          runMutation: (...args: Array<unknown>) => runMutationMock(...args),
        } as never,
        { newEmail: 'new@example.com' },
      ),
    ).rejects.toThrow()
  })

  it('bubbles sendEmail errors', async () => {
    const module = (await import('../emailChange')) as any
    runMutationMock.mockResolvedValueOnce({
      newEmail: 'new@example.com',
      expiresAt: 5000,
    })
    sendEmailMock.mockRejectedValueOnce(new Error('Email provider down'))

    await expect(
      module.requestEmailChange.handler(
        {
          runMutation: (...args: Array<unknown>) => runMutationMock(...args),
        } as never,
        { newEmail: 'new@example.com' },
      ),
    ).rejects.toThrow('Email provider down')
  })

  it('returns invalid token without mutation call when token blank', async () => {
    const module = (await import('../emailChange')) as any
    const result = await module.verifyEmailChange.handler(
      {
        runMutation: (...args: Array<unknown>) => runMutationMock(...args),
      } as never,
      { token: '   ' },
    )

    expect(result).toEqual({ status: 'invalid_token' })
    expect(runMutationMock).not.toHaveBeenCalled()
  })

  it('verifies token via internal mutation', async () => {
    const module = (await import('../emailChange')) as any
    runMutationMock.mockResolvedValueOnce({
      status: 'verified',
      newEmail: 'new@example.com',
    })

    const result = await module.verifyEmailChange.handler(
      {
        runMutation: (...args: Array<unknown>) => runMutationMock(...args),
      } as never,
      { token: 'token123' },
    )

    expect(runMutationMock).toHaveBeenCalledWith(
      'verifyEmailChangeTokenRef',
      expect.objectContaining({ tokenHash: 'hash:token123' }),
    )
    expect(result).toEqual({ status: 'verified', newEmail: 'new@example.com' })
  })

  it('forwards verify statuses from internal mutation', async () => {
    const module = (await import('../emailChange')) as any
    for (const payload of [
      { status: 'already_used', newEmail: 'new@example.com' },
      { status: 'expired', newEmail: 'new@example.com' },
      { status: 'email_taken' },
    ]) {
      runMutationMock.mockResolvedValueOnce(payload)
      const result = await module.verifyEmailChange.handler(
        {
          runMutation: (...args: Array<unknown>) => runMutationMock(...args),
        } as never,
        { token: 'token123' },
      )
      expect(result).toEqual(payload)
    }
  })
})
