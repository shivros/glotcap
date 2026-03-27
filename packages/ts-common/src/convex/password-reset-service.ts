import { ConvexError } from 'convex/values'
import { escapeHtml } from './email-html'
import {
  generateEmailChangeToken,
  hashEmailChangeToken,
  normalizeAuthEmail,
  requireValidAuthEmail,
} from './email-change'
import { validatePasswordPolicy } from './password-policy'
import {
  PASSWORD_RESET_CANCELLED,
  PASSWORD_RESET_CONSUMED,
  PASSWORD_RESET_EXPIRED,
  PASSWORD_RESET_PENDING,
  PASSWORD_RESET_RATE_LIMIT_MS,
  PASSWORD_RESET_REQUEST_TTL_MS,
  buildPasswordResetLink,
  resolvePasswordResetExpiry,
} from './password-reset'

export type PasswordResetRequestRecord<TRequestId> = {
  _id: TRequestId
  email: string
  tokenHash: string
  status: 'pending' | 'consumed' | 'expired' | 'cancelled'
  requestedAt: number
  updatedAt: number
  expiresAt: number
  consumedAt?: number
  lastSentAt: number
}

export type PasswordResetAccountRef<TUserId> = {
  providerAccountId: string
  userId: TUserId
}

export type PasswordResetStorePort<TRequestId, TUserId = unknown> = {
  findPasswordAccountByEmail: (
    email: string,
  ) => Promise<PasswordResetAccountRef<TUserId> | null>
  findPendingRequestByEmail: (
    email: string,
  ) => Promise<PasswordResetRequestRecord<TRequestId> | null>
  listPendingRequestsByEmail: (
    email: string,
  ) => Promise<Array<PasswordResetRequestRecord<TRequestId>>>
  findRequestByTokenHash: (
    tokenHash: string,
  ) => Promise<PasswordResetRequestRecord<TRequestId> | null>
  insertRequest: (
    request: Omit<PasswordResetRequestRecord<TRequestId>, '_id'>,
  ) => Promise<void>
  patchRequest: (
    requestId: TRequestId,
    patch: Partial<PasswordResetRequestRecord<TRequestId>>,
  ) => Promise<void>
}

export type PasswordResetAuthPort = {
  updatePassword: (params: {
    providerAccountId: string
    newPassword: string
  }) => Promise<void>
  invalidateAllSessions: (email: string) => Promise<void>
}

export type PasswordResetMailerPort<TActionCtx> = {
  sendResetEmail: (
    ctx: TActionCtx,
    params: {
      to: string
      resetUrl: string
      expiresAt: number
    },
  ) => Promise<void>
}

export type PasswordResetConfig = {
  resetPath?: string
  ttlMs?: number
  rateLimitMs?: number
  now?: () => number
  createToken?: () => string
  hashToken?: (token: string) => Promise<string>
  validateNewPassword?: (password: string) => void
}

type ResolvedRequest<TRequestId> =
  | { status: 'valid'; request: PasswordResetRequestRecord<TRequestId> }
  | { status: 'invalid_token' }
  | { status: 'expired'; email: string }
  | { status: 'already_used'; email: string }

export type PasswordResetPrepareResult<TRequestId, TUserId = unknown> =
  | {
      status: 'ready'
      providerAccountId: string
      userId: TUserId
      requestId: TRequestId
      email: string
    }
  | { status: 'invalid_token' }
  | { status: 'expired'; email: string }
  | { status: 'already_used'; email: string }

export function createPasswordResetService<
  TRequestId,
  TActionCtx,
  TUserId = unknown,
>(params: {
  config?: PasswordResetConfig
  store: PasswordResetStorePort<TRequestId, TUserId>
  auth?: PasswordResetAuthPort
  mailer?: PasswordResetMailerPort<TActionCtx>
  getSiteUrl?: () => string
}) {
  function requireAuth(): PasswordResetAuthPort {
    if (!params.auth) {
      throw new Error(
        'PasswordResetAuthPort is required for this operation. ' +
          'Pass auth when calling createPasswordResetService.',
      )
    }
    return params.auth
  }

  function requireMailer(): PasswordResetMailerPort<TActionCtx> {
    if (!params.mailer) {
      throw new Error(
        'PasswordResetMailerPort is required for this operation. ' +
          'Pass mailer when calling createPasswordResetService.',
      )
    }
    return params.mailer
  }

  function requireGetSiteUrl(): () => string {
    if (!params.getSiteUrl) {
      throw new Error(
        'getSiteUrl is required for this operation. ' +
          'Pass getSiteUrl when calling createPasswordResetService.',
      )
    }
    return params.getSiteUrl
  }

  const now = params.config?.now ?? (() => Date.now())
  const ttlMs = params.config?.ttlMs ?? PASSWORD_RESET_REQUEST_TTL_MS
  const rateLimitMs = params.config?.rateLimitMs ?? PASSWORD_RESET_RATE_LIMIT_MS
  const createToken = params.config?.createToken ?? generateEmailChangeToken
  const hashToken = params.config?.hashToken ?? hashEmailChangeToken
  const validateNewPasswordFn =
    params.config?.validateNewPassword ?? validatePasswordPolicy

  const resolveRequest = async (args: {
    tokenHash: string
    nowMs: number
  }): Promise<ResolvedRequest<TRequestId>> => {
    const request = await params.store.findRequestByTokenHash(args.tokenHash)
    if (!request) {
      return { status: 'invalid_token' }
    }
    if (request.status === PASSWORD_RESET_CONSUMED) {
      return { status: 'already_used', email: request.email }
    }
    if (request.status !== PASSWORD_RESET_PENDING) {
      return { status: 'invalid_token' }
    }
    if (request.expiresAt <= args.nowMs) {
      await params.store.patchRequest(request._id, {
        status: PASSWORD_RESET_EXPIRED,
        updatedAt: args.nowMs,
      })
      return { status: 'expired', email: request.email }
    }
    return { status: 'valid', request }
  }

  const beginRequest = async (args: {
    email: string
    tokenHash: string
    nowMs: number
    expiresAt: number
  }): Promise<{ sent: boolean; email: string }> => {
    const email = normalizeAuthEmail(args.email)

    const account = await params.store.findPasswordAccountByEmail(email)
    if (!account) {
      return { sent: false, email }
    }

    const existing = await params.store.findPendingRequestByEmail(email)
    if (existing && args.nowMs - existing.lastSentAt < rateLimitMs) {
      throw new ConvexError({
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: 'Please wait before requesting another reset email.',
      })
    }

    const pendingRequests = await params.store.listPendingRequestsByEmail(email)
    for (const pending of pendingRequests) {
      await params.store.patchRequest(pending._id, {
        status: PASSWORD_RESET_CANCELLED,
        updatedAt: args.nowMs,
      })
    }

    await params.store.insertRequest({
      email,
      tokenHash: args.tokenHash,
      status: PASSWORD_RESET_PENDING,
      requestedAt: args.nowMs,
      updatedAt: args.nowMs,
      expiresAt: args.expiresAt,
      lastSentAt: args.nowMs,
    })

    return { sent: true, email }
  }

  const verifyTokenHash = async (args: {
    tokenHash: string
    nowMs: number
  }): Promise<
    | { status: 'valid'; email: string }
    | { status: 'invalid_token' }
    | { status: 'expired'; email: string }
    | { status: 'already_used'; email: string }
  > => {
    const resolved = await resolveRequest(args)
    if (resolved.status === 'valid') {
      return { status: 'valid', email: resolved.request.email }
    }
    return resolved
  }

  const validatePasswordInput = (
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (newPassword !== confirmPassword) {
      throw new ConvexError({
        code: 'PASSWORD_CONFIRMATION_MISMATCH',
        message: 'New password and confirmation do not match.',
      })
    }

    try {
      validateNewPasswordFn(newPassword)
    } catch (error) {
      throw new ConvexError({
        code: 'PASSWORD_POLICY_VIOLATION',
        message:
          error instanceof Error ? error.message : 'Password policy violation.',
      })
    }
  }

  const preparePasswordReset = async (args: {
    tokenHash: string
    newPassword: string
    confirmPassword: string
    nowMs: number
  }): Promise<PasswordResetPrepareResult<TRequestId, TUserId>> => {
    const resolved = await resolveRequest({
      tokenHash: args.tokenHash,
      nowMs: args.nowMs,
    })
    if (resolved.status !== 'valid') {
      return resolved
    }

    validatePasswordInput(args.newPassword, args.confirmPassword)

    const account = await params.store.findPasswordAccountByEmail(
      resolved.request.email,
    )
    if (!account) {
      return { status: 'invalid_token' }
    }

    return {
      status: 'ready',
      providerAccountId: account.providerAccountId,
      userId: account.userId,
      requestId: resolved.request._id,
      email: resolved.request.email,
    }
  }

  const consumeRequest = async (args: {
    requestId: TRequestId
    nowMs: number
  }) => {
    await params.store.patchRequest(args.requestId, {
      status: PASSWORD_RESET_CONSUMED,
      consumedAt: args.nowMs,
      updatedAt: args.nowMs,
    })
  }

  const resetPassword = async (args: {
    tokenHash: string
    newPassword: string
    confirmPassword: string
    nowMs: number
  }): Promise<
    | { status: 'password_reset' }
    | { status: 'invalid_token' }
    | { status: 'expired'; email: string }
    | { status: 'already_used'; email: string }
  > => {
    const preparation = await preparePasswordReset(args)
    if (preparation.status !== 'ready') {
      return preparation
    }

    const auth = requireAuth()
    await auth.updatePassword({
      providerAccountId: preparation.providerAccountId,
      newPassword: args.newPassword,
    })

    await auth.invalidateAllSessions(preparation.email)

    await consumeRequest({
      requestId: preparation.requestId,
      nowMs: args.nowMs,
    })

    return { status: 'password_reset' }
  }

  return {
    beginRequest,
    verifyTokenHash,
    preparePasswordReset,
    consumeRequest,
    resetPassword,

    async requestWithResetEmail(args: {
      actionCtx: TActionCtx
      email: string
    }) {
      const email = requireValidAuthEmail(args.email)
      const token = createToken()
      const tokenHash = await hashToken(token)
      const nowMs = now()
      const expiresAt = resolvePasswordResetExpiry(nowMs, ttlMs)

      const result = await beginRequest({
        email,
        tokenHash,
        nowMs,
        expiresAt,
      })

      if (result.sent) {
        const resetUrl = buildPasswordResetLink({
          siteUrl: requireGetSiteUrl()(),
          token,
          path: params.config?.resetPath,
        })
        await requireMailer().sendResetEmail(args.actionCtx, {
          to: result.email,
          resetUrl,
          expiresAt,
        })
      }

      return { status: 'reset_email_sent' as const }
    },

    async verifyToken(tokenInput: string) {
      const token = tokenInput.trim()
      if (!token) {
        return { status: 'invalid_token' as const }
      }
      const tokenHash = await hashToken(token)
      return await verifyTokenHash({ tokenHash, nowMs: now() })
    },

    async resetPasswordWithToken(args: {
      tokenInput: string
      newPassword: string
      confirmPassword: string
    }) {
      const token = args.tokenInput.trim()
      if (!token) {
        return { status: 'invalid_token' as const }
      }
      const tokenHash = await hashToken(token)
      return await resetPassword({
        tokenHash,
        newPassword: args.newPassword,
        confirmPassword: args.confirmPassword,
        nowMs: now(),
      })
    },
  }
}

export function buildDefaultPasswordResetTemplate(params: {
  appName: string
  resetUrl: string
  expiresAt: number
}) {
  const expirationIso = new Date(params.expiresAt).toUTCString()
  const safeUrl = escapeHtml(params.resetUrl)
  const safeAppName = escapeHtml(params.appName)
  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f1b22;">',
    `  <h2 style="margin:0 0 12px;">Reset your ${safeAppName} password</h2>`,
    '  <p style="margin:0 0 12px;">We received a request to reset the password for your account.</p>',
    `  <p style="margin:0 0 16px;"><a href="${safeUrl}" style="background:#ff6b3d;color:#ffffff;padding:10px 16px;border-radius:999px;text-decoration:none;display:inline-block;">Reset password</a></p>`,
    `  <p style="margin:0 0 12px;">This link expires at ${escapeHtml(expirationIso)}.</p>`,
    '  <p style="margin:0;color:#6b6770;font-size:12px;">If you did not request this, you can safely ignore this email.</p>',
    '</div>',
  ].join('')
  const text = [
    `Reset your password for ${params.appName}.`,
    '',
    `Reset link: ${params.resetUrl}`,
    `This link expires at ${expirationIso}.`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n')
  return {
    subject: `Reset your ${params.appName} password`,
    html,
    text,
  }
}
