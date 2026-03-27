import type { PasswordResetPrepareResult } from './password-reset-service'

export type RequestPasswordResetResult = {
  status: 'reset_email_sent'
}

export type RequestPasswordResetPorts<TActionCtx> = {
  normalizeEmail: (email: string) => string
  createToken: () => string
  hashToken: (token: string) => Promise<string>
  now: () => number
  resolveExpiry: (nowMs: number, ttlMs: number) => number
  ttlMs: number
  beginPasswordResetRequest: (params: {
    email: string
    tokenHash: string
    now: number
    expiresAt: number
  }) => Promise<{ sent: boolean; email: string }>
  buildResetLink: (token: string) => string
  buildEmailTemplate: (params: { resetUrl: string; expiresAt: number }) => {
    subject: string
    html: string
    text: string
  }
  sendResetEmail: (
    actionCtx: TActionCtx,
    params: {
      to: string
      subject: string
      html: string
      text: string
    },
  ) => Promise<unknown>
}

export async function requestPasswordResetWithPorts<TActionCtx>(
  ports: RequestPasswordResetPorts<TActionCtx>,
  params: {
    actionCtx: TActionCtx
    emailInput: string
  },
): Promise<RequestPasswordResetResult> {
  const email = ports.normalizeEmail(params.emailInput)
  const token = ports.createToken()
  const tokenHash = await ports.hashToken(token)
  const now = ports.now()
  const expiresAt = ports.resolveExpiry(now, ports.ttlMs)

  const result = await ports.beginPasswordResetRequest({
    email,
    tokenHash,
    now,
    expiresAt,
  })

  if (result.sent) {
    const resetUrl = ports.buildResetLink(token)
    const message = ports.buildEmailTemplate({
      resetUrl,
      expiresAt,
    })
    await ports.sendResetEmail(params.actionCtx, {
      to: result.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  }

  return { status: 'reset_email_sent' }
}

export type ResetPasswordResult =
  | { status: 'password_reset' }
  | { status: 'invalid_token' }
  | { status: 'expired'; email: string }
  | { status: 'already_used'; email: string }

export type ResetPasswordPorts<TActionCtx, TUserId, TRequestId> = {
  hashToken: (token: string) => Promise<string>
  now: () => number
  verifyAndPrepareReset: (params: {
    tokenHash: string
    newPassword: string
    confirmPassword: string
    now: number
  }) => Promise<PasswordResetPrepareResult<TRequestId, TUserId>>
  updatePassword: (
    actionCtx: TActionCtx,
    params: {
      providerAccountId: string
      newPassword: string
    },
  ) => Promise<unknown>
  invalidateSessions: (
    actionCtx: TActionCtx,
    params: { userId: TUserId },
  ) => Promise<unknown>
  markResetConsumed: (params: {
    requestId: TRequestId
    now: number
  }) => Promise<unknown>
}

export async function resetPasswordWithPorts<TActionCtx, TUserId, TRequestId>(
  ports: ResetPasswordPorts<TActionCtx, TUserId, TRequestId>,
  params: {
    actionCtx: TActionCtx
    tokenInput: string
    newPassword: string
    confirmPassword: string
  },
): Promise<ResetPasswordResult> {
  const token = params.tokenInput.trim()
  if (!token) {
    return { status: 'invalid_token' }
  }

  const tokenHash = await ports.hashToken(token)
  const now = ports.now()
  const preparation = await ports.verifyAndPrepareReset({
    tokenHash,
    newPassword: params.newPassword,
    confirmPassword: params.confirmPassword,
    now,
  })

  if (preparation.status !== 'ready') {
    return preparation
  }

  await ports.updatePassword(params.actionCtx, {
    providerAccountId: preparation.providerAccountId,
    newPassword: params.newPassword,
  })
  await ports.invalidateSessions(params.actionCtx, {
    userId: preparation.userId,
  })
  await ports.markResetConsumed({
    requestId: preparation.requestId,
    now,
  })

  return { status: 'password_reset' }
}
