import { ConvexError } from 'convex/values'
import {
  EMAIL_CHANGE_CANCELLED,
  EMAIL_CHANGE_CONSUMED,
  EMAIL_CHANGE_EXPIRED,
  EMAIL_CHANGE_PENDING,
  EMAIL_CHANGE_REQUEST_TTL_MS,
  EMAIL_CHANGE_RESEND_COOLDOWN_MS,
  buildEmailChangeStatusView,
  buildEmailChangeVerificationLink,
  generateEmailChangeToken,
  hashEmailChangeToken,
  requireValidAuthEmail,
  resolveEmailChangeExpiry,
} from './email-change'

export type EmailChangeRequestRecord<TUserId, TRequestId> = {
  _id: TRequestId
  userId: TUserId
  currentEmail: string
  newEmail: string
  tokenHash: string
  status: 'pending' | 'consumed' | 'cancelled' | 'expired'
  requestedAt: number
  updatedAt: number
  expiresAt: number
  verifiedAt?: number
  consumedAt?: number
  cancelledAt?: number
  resendCount: number
  lastSentAt: number
}

export type EmailChangeUserRecord<TUserId> = {
  _id: TUserId
  email?: string
  emailVerificationTime?: number
}

export type EmailChangeStorePort<TUserId, TRequestId> = {
  getUserById: (
    userId: TUserId,
  ) => Promise<EmailChangeUserRecord<TUserId> | null>
  findUsersByEmail: (
    email: string,
  ) => Promise<Array<Pick<EmailChangeUserRecord<TUserId>, '_id'>>>
  findPendingRequestByUser: (
    userId: TUserId,
  ) => Promise<EmailChangeRequestRecord<TUserId, TRequestId> | null>
  listPendingRequestsByUser: (
    userId: TUserId,
  ) => Promise<Array<EmailChangeRequestRecord<TUserId, TRequestId>>>
  findPendingRequestByNewEmail: (
    email: string,
  ) => Promise<EmailChangeRequestRecord<TUserId, TRequestId> | null>
  findRequestByTokenHash: (
    tokenHash: string,
  ) => Promise<EmailChangeRequestRecord<TUserId, TRequestId> | null>
  insertRequest: (
    request: Omit<EmailChangeRequestRecord<TUserId, TRequestId>, '_id'>,
  ) => Promise<void>
  patchRequest: (
    requestId: TRequestId,
    patch: Partial<EmailChangeRequestRecord<TUserId, TRequestId>>,
  ) => Promise<void>
  patchUser: (
    userId: TUserId,
    patch: Partial<EmailChangeUserRecord<TUserId>>,
  ) => Promise<void>
}

export type EmailChangeAuthAccountPort<TUserId> = {
  finalizeEmailIdentifierChange: (params: {
    userId: TUserId
    newEmail: string
  }) => Promise<'ok' | 'email_taken'>
}

export type EmailChangeMailerPort<TActionCtx> = {
  sendVerificationEmail: (
    ctx: TActionCtx,
    params: {
      to: string
      verificationUrl: string
      expiresAt: number
    },
  ) => Promise<void>
}

export type EmailChangeConfig = {
  verificationPath?: string
  ttlMs?: number
  resendCooldownMs?: number
  now?: () => number
  createToken?: () => string
  hashToken?: (token: string) => Promise<string>
}

export async function getEmailChangeStatus<TUserId, TRequestId>(
  store: Pick<
    EmailChangeStorePort<TUserId, TRequestId>,
    'getUserById' | 'findPendingRequestByUser'
  >,
  userId: TUserId,
  now: number = Date.now(),
) {
  const user = await store.getUserById(userId)
  const currentEmail = user?.email ? requireValidAuthEmail(user.email) : null
  const pendingRequest = await store.findPendingRequestByUser(userId)
  return buildEmailChangeStatusView({ currentEmail, pendingRequest, now })
}

export function createEmailChangeService<
  TUserId,
  TRequestId,
  TActionCtx,
>(params: {
  config?: EmailChangeConfig
  store: EmailChangeStorePort<TUserId, TRequestId>
  authAccounts: EmailChangeAuthAccountPort<TUserId>
  mailer: EmailChangeMailerPort<TActionCtx>
  getSiteUrl: () => string
}) {
  const now = params.config?.now ?? (() => Date.now())
  const ttlMs = params.config?.ttlMs ?? EMAIL_CHANGE_REQUEST_TTL_MS
  const resendCooldownMs =
    params.config?.resendCooldownMs ?? EMAIL_CHANGE_RESEND_COOLDOWN_MS
  const createToken = params.config?.createToken ?? generateEmailChangeToken
  const hashToken = params.config?.hashToken ?? hashEmailChangeToken

  const beginRequest = async (args: {
    userId: TUserId
    newEmailInput: string
    tokenHash: string
    nowMs: number
    expiresAt: number
  }) => {
    const user = await params.store.getUserById(args.userId)
    const currentEmail = requireValidAuthEmail(user?.email ?? '')
    const newEmail = requireValidAuthEmail(args.newEmailInput)

    if (newEmail === currentEmail) {
      throw new ConvexError({
        code: 'EMAIL_UNCHANGED',
        message: 'New email must be different from your current email.',
      })
    }

    const usersWithEmail = await params.store.findUsersByEmail(newEmail)
    if (usersWithEmail.some((candidate) => candidate._id !== args.userId)) {
      throw new ConvexError({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'That email is already associated with another account.',
      })
    }

    const existingPendingForEmail =
      await params.store.findPendingRequestByNewEmail(newEmail)
    if (
      existingPendingForEmail &&
      existingPendingForEmail.userId !== args.userId
    ) {
      throw new ConvexError({
        code: 'EMAIL_CHANGE_ALREADY_PENDING',
        message: 'That email already has a pending verification request.',
      })
    }

    const pendingForUser = await params.store.listPendingRequestsByUser(
      args.userId,
    )
    for (const pending of pendingForUser) {
      await params.store.patchRequest(pending._id, {
        status: EMAIL_CHANGE_CANCELLED,
        cancelledAt: args.nowMs,
        updatedAt: args.nowMs,
      })
    }

    await params.store.insertRequest({
      userId: args.userId,
      currentEmail,
      newEmail,
      tokenHash: args.tokenHash,
      status: EMAIL_CHANGE_PENDING,
      requestedAt: args.nowMs,
      updatedAt: args.nowMs,
      expiresAt: args.expiresAt,
      resendCount: 0,
      lastSentAt: args.nowMs,
    })

    return {
      newEmail,
      expiresAt: args.expiresAt,
    }
  }

  const resendRequest = async (args: {
    userId: TUserId
    tokenHash: string
    nowMs: number
    expiresAt: number
  }) => {
    const pending = await params.store.findPendingRequestByUser(args.userId)
    if (!pending) {
      throw new ConvexError({
        code: 'NO_PENDING_EMAIL_CHANGE',
        message: 'No pending email change request was found.',
      })
    }

    if (pending.expiresAt <= args.nowMs) {
      await params.store.patchRequest(pending._id, {
        status: EMAIL_CHANGE_EXPIRED,
        updatedAt: args.nowMs,
      })
      throw new ConvexError({
        code: 'EMAIL_CHANGE_EXPIRED',
        message: 'Your email change link has expired. Please request again.',
      })
    }

    if (args.nowMs - pending.lastSentAt < resendCooldownMs) {
      throw new ConvexError({
        code: 'EMAIL_CHANGE_RATE_LIMITED',
        message: 'Please wait before requesting another verification email.',
      })
    }

    const resendCount = pending.resendCount + 1
    await params.store.patchRequest(pending._id, {
      tokenHash: args.tokenHash,
      updatedAt: args.nowMs,
      expiresAt: args.expiresAt,
      resendCount,
      lastSentAt: args.nowMs,
    })

    return {
      newEmail: pending.newEmail,
      expiresAt: args.expiresAt,
      resendCount,
    }
  }

  const verifyTokenHash = async (args: {
    tokenHash: string
    nowMs: number
  }) => {
    const request = await params.store.findRequestByTokenHash(args.tokenHash)
    if (!request) {
      return { status: 'invalid_token' as const }
    }
    if (request.status === EMAIL_CHANGE_CONSUMED) {
      return {
        status: 'already_used' as const,
        newEmail: request.newEmail,
      }
    }
    if (request.status !== EMAIL_CHANGE_PENDING) {
      return { status: 'invalid_token' as const }
    }
    if (request.expiresAt <= args.nowMs) {
      await params.store.patchRequest(request._id, {
        status: EMAIL_CHANGE_EXPIRED,
        updatedAt: args.nowMs,
      })
      return {
        status: 'expired' as const,
        newEmail: request.newEmail,
      }
    }

    const user = await params.store.getUserById(request.userId)
    if (!user) {
      return { status: 'invalid_token' as const }
    }

    const conflictingUsers = await params.store.findUsersByEmail(
      request.newEmail,
    )
    if (
      conflictingUsers.some((existingUser) => existingUser._id !== user._id)
    ) {
      return { status: 'email_taken' as const }
    }

    const accountUpdate =
      await params.authAccounts.finalizeEmailIdentifierChange({
        userId: request.userId,
        newEmail: request.newEmail,
      })
    if (accountUpdate === 'email_taken') {
      return { status: 'email_taken' as const }
    }

    await params.store.patchUser(request.userId, {
      email: request.newEmail,
      emailVerificationTime: args.nowMs,
    })
    await params.store.patchRequest(request._id, {
      status: EMAIL_CHANGE_CONSUMED,
      verifiedAt: args.nowMs,
      consumedAt: args.nowMs,
      updatedAt: args.nowMs,
    })

    return {
      status: 'verified' as const,
      newEmail: request.newEmail,
    }
  }

  return {
    async getStatus(userId: TUserId) {
      return getEmailChangeStatus(params.store, userId, now())
    },

    async cancelPending(userId: TUserId) {
      const pendingRequests =
        await params.store.listPendingRequestsByUser(userId)
      const nowMs = now()
      for (const request of pendingRequests) {
        await params.store.patchRequest(request._id, {
          status: EMAIL_CHANGE_CANCELLED,
          cancelledAt: nowMs,
          updatedAt: nowMs,
        })
      }
      return { cancelledCount: pendingRequests.length }
    },

    async beginRequestForUser(
      userId: TUserId,
      args: {
        newEmailInput: string
        tokenHash: string
        nowMs: number
        expiresAt: number
      },
    ) {
      return beginRequest({
        userId,
        newEmailInput: args.newEmailInput,
        tokenHash: args.tokenHash,
        nowMs: args.nowMs,
        expiresAt: args.expiresAt,
      })
    },

    async resendRequestForUser(
      userId: TUserId,
      args: {
        tokenHash: string
        nowMs: number
        expiresAt: number
      },
    ) {
      return resendRequest({
        userId,
        tokenHash: args.tokenHash,
        nowMs: args.nowMs,
        expiresAt: args.expiresAt,
      })
    },

    async requestWithVerificationEmail(args: {
      actionCtx: TActionCtx
      userId: TUserId
      newEmailInput: string
    }) {
      const token = createToken()
      const tokenHash = await hashToken(token)
      const nowMs = now()
      const expiresAt = resolveEmailChangeExpiry(nowMs, ttlMs)
      const created = await beginRequest({
        userId: args.userId,
        newEmailInput: args.newEmailInput,
        tokenHash,
        nowMs,
        expiresAt,
      })
      const verificationUrl = buildEmailChangeVerificationLink({
        siteUrl: params.getSiteUrl(),
        token,
        path: params.config?.verificationPath,
      })
      await params.mailer.sendVerificationEmail(args.actionCtx, {
        to: created.newEmail,
        verificationUrl,
        expiresAt: created.expiresAt,
      })
      return {
        status: 'verification_sent' as const,
        newEmail: created.newEmail,
        expiresAt: created.expiresAt,
      }
    },

    async resendWithVerificationEmail(args: {
      actionCtx: TActionCtx
      userId: TUserId
    }) {
      const token = createToken()
      const tokenHash = await hashToken(token)
      const nowMs = now()
      const expiresAt = resolveEmailChangeExpiry(nowMs, ttlMs)
      const updated = await resendRequest({
        userId: args.userId,
        tokenHash,
        nowMs,
        expiresAt,
      })
      const verificationUrl = buildEmailChangeVerificationLink({
        siteUrl: params.getSiteUrl(),
        token,
        path: params.config?.verificationPath,
      })
      await params.mailer.sendVerificationEmail(args.actionCtx, {
        to: updated.newEmail,
        verificationUrl,
        expiresAt: updated.expiresAt,
      })
      return {
        status: 'verification_resent' as const,
        newEmail: updated.newEmail,
        expiresAt: updated.expiresAt,
        resendCount: updated.resendCount,
      }
    },

    verifyTokenHash,

    async verifyToken(tokenInput: string) {
      const token = tokenInput.trim()
      if (!token) {
        return { status: 'invalid_token' as const }
      }
      const tokenHash = await hashToken(token)
      return await verifyTokenHash({
        tokenHash,
        nowMs: now(),
      })
    },
  }
}

export function buildDefaultEmailChangeTemplate(params: {
  appName: string
  verificationUrl: string
  expiresAt: number
}) {
  const expirationIso = new Date(params.expiresAt).toUTCString()
  const safeUrl = escapeHtml(params.verificationUrl)
  const safeAppName = escapeHtml(params.appName)
  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f1b22;">',
    `  <h2 style="margin:0 0 12px;">Confirm your new ${safeAppName} email</h2>`,
    '  <p style="margin:0 0 12px;">Use the button below to confirm this email address.</p>',
    `  <p style="margin:0 0 16px;"><a href="${safeUrl}" style="background:#ff6b3d;color:#ffffff;padding:10px 16px;border-radius:999px;text-decoration:none;display:inline-block;">Confirm new email</a></p>`,
    `  <p style="margin:0 0 12px;">This link expires at ${escapeHtml(expirationIso)}.</p>`,
    '  <p style="margin:0;color:#6b6770;font-size:12px;">If you did not request this change, you can ignore this email.</p>',
    '</div>',
  ].join('')
  const text = [
    `Confirm your new email for ${params.appName}.`,
    '',
    `Verification link: ${params.verificationUrl}`,
    `This link expires at ${expirationIso}.`,
  ].join('\n')
  return {
    subject: `Confirm your new ${params.appName} email`,
    html,
    text,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
