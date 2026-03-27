// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  actionMock,
  sendEmailMock,
  buildPasswordResetLinkMock,
  generateEmailChangeTokenMock,
  hashEmailChangeTokenMock,
  normalizeAuthEmailMock,
  modifyAccountCredentialsMock,
  invalidateSessionsMock,
} = vi.hoisted(() => ({
  actionMock: vi.fn((definition: unknown) => definition),
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
  buildPasswordResetLinkMock: vi.fn(
    ({ siteUrl, token, path }) => `${siteUrl}${path}?token=${token}`,
  ),
  generateEmailChangeTokenMock: vi.fn(() => 'plain_token_abc'),
  hashEmailChangeTokenMock: vi.fn(() => Promise.resolve('hashed_token_abc')),
  normalizeAuthEmailMock: vi.fn((email: string) => email.trim().toLowerCase()),
  modifyAccountCredentialsMock: vi.fn().mockResolvedValue(undefined),
  invalidateSessionsMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../convex/_generated/server', () => ({
  action: actionMock,
}))

vi.mock('../../convex/_generated/api', () => ({
  internal: {
    passwordResetInternal: {
      beginPasswordResetRequest: 'beginPasswordResetRequestRef',
      verifyAndPrepareReset: 'verifyAndPrepareResetRef',
      markResetConsumed: 'markResetConsumedRef',
    },
  },
}))

vi.mock('../../convex/emails', () => ({
  resend: { sendEmail: sendEmailMock },
}))

vi.mock('ts-common/convex/email-change', () => ({
  generateEmailChangeToken: generateEmailChangeTokenMock,
  hashEmailChangeToken: hashEmailChangeTokenMock,
  normalizeAuthEmail: normalizeAuthEmailMock,
}))

vi.mock('ts-common/convex/password-reset', () => ({
  DEFAULT_PASSWORD_RESET_PATH: '/reset-password',
  PASSWORD_RESET_REQUEST_TTL_MS: 3_600_000,
  buildPasswordResetLink: buildPasswordResetLinkMock,
  resolvePasswordResetExpiry: vi.fn((now: number, ttl: number) => now + ttl),
}))

vi.mock('ts-common/convex/password-reset-service', () => ({
  buildDefaultPasswordResetTemplate: vi.fn(() => ({
    subject: 'Reset your password',
    html: '<p>reset</p>',
    text: 'reset',
  })),
}))

vi.mock('@convex-dev/auth/server', () => ({
  modifyAccountCredentials: modifyAccountCredentialsMock,
  invalidateSessions: invalidateSessionsMock,
}))

type HandlerDefinition = {
  args: Record<string, unknown>
  handler: (ctx: any, args: any) => Promise<any>
}

let requestPasswordReset: HandlerDefinition
let resetPassword: HandlerDefinition

beforeAll(async () => {
  process.env.SITE_URL = 'https://glotcap.test'
  await import('../../convex/passwordReset')
  const calls = actionMock.mock.calls
  requestPasswordReset = calls[0]?.[0] as HandlerDefinition
  resetPassword = calls[1]?.[0] as HandlerDefinition
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SITE_URL = 'https://glotcap.test'
  delete process.env.RESEND_FROM
})

describe('requestPasswordReset', () => {
  it('normalizes email, begins request, and sends email for known users', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })

    await requestPasswordReset.handler(
      { runMutation: runMutationMock },
      { email: '  User@Example.com  ' },
    )

    expect(normalizeAuthEmailMock).toHaveBeenCalledWith('  User@Example.com  ')
    expect(generateEmailChangeTokenMock).toHaveBeenCalled()
    expect(hashEmailChangeTokenMock).toHaveBeenCalledWith('plain_token_abc')
    expect(runMutationMock).toHaveBeenCalledWith(
      'beginPasswordResetRequestRef',
      expect.objectContaining({
        email: 'user@example.com',
        tokenHash: 'hashed_token_abc',
      }),
    )
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your password',
      }),
    )
    expect(buildPasswordResetLinkMock).toHaveBeenCalledWith({
      siteUrl: 'https://glotcap.test',
      token: 'plain_token_abc',
      path: '/reset-password',
    })
  })

  it('does not send an email when no account exists', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      sent: false,
      email: 'nobody@example.com',
    })

    const result = await requestPasswordReset.handler(
      { runMutation: runMutationMock },
      { email: 'nobody@example.com' },
    )

    expect(sendEmailMock).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'reset_email_sent' })
  })

  it('returns reset_email_sent to avoid account enumeration', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })

    const result = await requestPasswordReset.handler(
      { runMutation: runMutationMock },
      { email: 'user@example.com' },
    )

    expect(result).toEqual({ status: 'reset_email_sent' })
  })

  it('throws when SITE_URL is missing and email would be sent', async () => {
    delete process.env.SITE_URL
    const runMutationMock = vi.fn().mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })

    await expect(
      requestPasswordReset.handler(
        { runMutation: runMutationMock },
        { email: 'user@example.com' },
      ),
    ).rejects.toThrow('SITE_URL is not configured.')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('propagates mailer failures', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('Mailer down'))
    const runMutationMock = vi.fn().mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })

    await expect(
      requestPasswordReset.handler(
        { runMutation: runMutationMock },
        { email: 'user@example.com' },
      ),
    ).rejects.toThrow('Mailer down')
  })

  it('uses RESEND_FROM when configured', async () => {
    process.env.RESEND_FROM = 'GlotCap QA <qa@resend.dev>'
    vi.resetModules()
    actionMock.mockClear()
    await import('../../convex/passwordReset')
    const importedRequestPasswordReset = actionMock.mock
      .calls[0]?.[0] as HandlerDefinition

    const runMutationMock = vi.fn().mockResolvedValue({
      sent: true,
      email: 'user@example.com',
    })

    await importedRequestPasswordReset.handler(
      { runMutation: runMutationMock },
      { email: 'user@example.com' },
    )

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: 'GlotCap QA <qa@resend.dev>',
      }),
    )
  })
})

describe('resetPassword', () => {
  it('returns invalid_token when the token is blank', async () => {
    const result = await resetPassword.handler(
      { runMutation: vi.fn() },
      { token: '   ', newPassword: 'pass', confirmPassword: 'pass' },
    )

    expect(result).toEqual({ status: 'invalid_token' })
  })

  it('resets password, invalidates sessions, and marks request consumed', async () => {
    const runMutationMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'ready',
        providerAccountId: 'password|user@example.com',
        userId: 'user_1',
        requestId: 'request_1',
        email: 'user@example.com',
      })
      .mockResolvedValueOnce(undefined)

    const result = await resetPassword.handler(
      { runMutation: runMutationMock },
      {
        token: 'valid_token',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      },
    )

    expect(hashEmailChangeTokenMock).toHaveBeenCalledWith('valid_token')
    expect(runMutationMock).toHaveBeenNthCalledWith(
      1,
      'verifyAndPrepareResetRef',
      expect.objectContaining({
        tokenHash: 'hashed_token_abc',
        newPassword: 'new-password-123',
      }),
    )
    expect(modifyAccountCredentialsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        provider: 'password',
        account: {
          id: 'password|user@example.com',
          secret: 'new-password-123',
        },
      },
    )
    expect(invalidateSessionsMock).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user_1',
    })
    expect(runMutationMock).toHaveBeenNthCalledWith(
      2,
      'markResetConsumedRef',
      expect.objectContaining({ requestId: 'request_1' }),
    )
    expect(result).toEqual({ status: 'password_reset' })
  })

  it('returns expired status and does not call auth updates', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      status: 'expired',
      email: 'user@example.com',
    })

    const result = await resetPassword.handler(
      { runMutation: runMutationMock },
      {
        token: 'expired_token',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      },
    )

    expect(result).toEqual({ status: 'expired', email: 'user@example.com' })
    expect(modifyAccountCredentialsMock).not.toHaveBeenCalled()
    expect(invalidateSessionsMock).not.toHaveBeenCalled()
  })

  it('returns already_used status and skips auth updates', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      status: 'already_used',
      email: 'user@example.com',
    })

    const result = await resetPassword.handler(
      { runMutation: runMutationMock },
      {
        token: 'used_token',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      },
    )

    expect(result).toEqual({
      status: 'already_used',
      email: 'user@example.com',
    })
    expect(modifyAccountCredentialsMock).not.toHaveBeenCalled()
  })

  it('returns invalid_token status from verification and skips auth updates', async () => {
    const runMutationMock = vi.fn().mockResolvedValue({
      status: 'invalid_token',
    })

    const result = await resetPassword.handler(
      { runMutation: runMutationMock },
      {
        token: 'bad_token',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      },
    )

    expect(result).toEqual({ status: 'invalid_token' })
    expect(modifyAccountCredentialsMock).not.toHaveBeenCalled()
  })

  it('propagates password update failures and does not consume request', async () => {
    modifyAccountCredentialsMock.mockRejectedValueOnce(new Error('Auth failed'))
    const runMutationMock = vi.fn().mockResolvedValue({
      status: 'ready',
      providerAccountId: 'password|user@example.com',
      userId: 'user_1',
      requestId: 'request_1',
      email: 'user@example.com',
    })

    await expect(
      resetPassword.handler(
        { runMutation: runMutationMock },
        {
          token: 'valid_token',
          newPassword: 'new-password-123',
          confirmPassword: 'new-password-123',
        },
      ),
    ).rejects.toThrow('Auth failed')

    expect(invalidateSessionsMock).not.toHaveBeenCalled()
    expect(runMutationMock).toHaveBeenCalledTimes(1)
  })
})
