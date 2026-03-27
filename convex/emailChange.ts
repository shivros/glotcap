import { ConvexError, v } from 'convex/values'
import {
  EMAIL_CHANGE_REQUEST_TTL_MS,
  buildEmailChangeStatusView,
  buildEmailChangeVerificationLink,
  generateEmailChangeToken,
  hashEmailChangeToken,
  requireValidAuthEmail,
  resolveEmailChangeExpiry,
} from 'ts-common/convex/email-change'
import { buildDefaultEmailChangeTemplate } from 'ts-common/convex/email-change-service'
import { internal } from './_generated/api'
import { action, mutation, query } from './_generated/server'
import { resend } from './emails'
import { createEmailChangeMutationService } from './lib/emailChangeAdapters'
import { requireUserId } from './lib/requireUserId'

type Env = Record<string, string | undefined>

const APP_NAME = 'GlotCap'
const env = (globalThis as { process?: { env?: Env } }).process?.env ?? {}
const from = env.RESEND_FROM ?? `${APP_NAME} <onboarding@resend.dev>`

function requireSiteUrl() {
  const siteUrl = env.SITE_URL
  if (!siteUrl) {
    throw new ConvexError({
      code: 'AUTH_CONFIG_MISSING',
      message: 'SITE_URL is not configured.',
    })
  }
  return siteUrl
}

async function prepareVerificationToken() {
  const token = generateEmailChangeToken()
  const tokenHash = await hashEmailChangeToken(token)
  const now = Date.now()
  const expiresAt = resolveEmailChangeExpiry(now, EMAIL_CHANGE_REQUEST_TTL_MS)
  const verificationUrl = buildEmailChangeVerificationLink({
    siteUrl: requireSiteUrl(),
    token,
    path: '/account/email-change/verify',
  })
  return { token, tokenHash, now, expiresAt, verificationUrl }
}

async function sendVerificationEmail(params: {
  ctx: Parameters<typeof resend.sendEmail>[0]
  to: string
  verificationUrl: string
  expiresAt: number
}) {
  const message = buildDefaultEmailChangeTemplate({
    appName: APP_NAME,
    verificationUrl: params.verificationUrl,
    expiresAt: params.expiresAt,
  })

  await resend.sendEmail(params.ctx, {
    from,
    to: params.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
}

export const getEmailChangeStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const user = await ctx.db.get(userId)
    const currentEmail = user?.email ? requireValidAuthEmail(user.email) : null
    const pendingRequest = await ctx.db
      .query('emailChangeRequests')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', userId).eq('status', 'pending'),
      )
      .order('desc')
      .first()

    return buildEmailChangeStatusView({
      currentEmail,
      pendingRequest,
      now: Date.now(),
    })
  },
})

export const cancelEmailChange = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const service = createEmailChangeMutationService(ctx, requireSiteUrl)
    return await service.cancelPending(userId)
  },
})

export const requestEmailChange = action({
  args: {
    newEmail: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    status: 'verification_sent'
    newEmail: string
    expiresAt: number
  }> => {
    await requireUserId(ctx)
    const prepared = await prepareVerificationToken()

    const created: { newEmail: string; expiresAt: number } =
      await ctx.runMutation(
        internal.emailChangeInternal.beginEmailChangeRequest,
        {
          newEmail: args.newEmail,
          tokenHash: prepared.tokenHash,
          now: prepared.now,
          expiresAt: prepared.expiresAt,
        },
      )

    await sendVerificationEmail({
      ctx,
      to: created.newEmail,
      verificationUrl: prepared.verificationUrl,
      expiresAt: created.expiresAt,
    })

    return {
      status: 'verification_sent',
      newEmail: created.newEmail,
      expiresAt: created.expiresAt,
    }
  },
})

export const resendEmailChangeVerification = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    status: 'verification_resent'
    newEmail: string
    expiresAt: number
    resendCount: number
  }> => {
    await requireUserId(ctx)
    const prepared = await prepareVerificationToken()

    const updated: {
      newEmail: string
      expiresAt: number
      resendCount: number
    } = await ctx.runMutation(
      internal.emailChangeInternal.resendEmailChangeRequest,
      {
        tokenHash: prepared.tokenHash,
        now: prepared.now,
        expiresAt: prepared.expiresAt,
      },
    )

    await sendVerificationEmail({
      ctx,
      to: updated.newEmail,
      verificationUrl: prepared.verificationUrl,
      expiresAt: updated.expiresAt,
    })

    return {
      status: 'verification_resent',
      newEmail: updated.newEmail,
      expiresAt: updated.expiresAt,
      resendCount: updated.resendCount,
    }
  },
})

export const verifyEmailChange = action({
  args: {
    token: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { status: 'invalid_token' }
    | { status: 'already_used'; newEmail: string }
    | { status: 'expired'; newEmail: string }
    | { status: 'email_taken' }
    | { status: 'verified'; newEmail: string }
  > => {
    const token = args.token.trim()
    if (!token) {
      return {
        status: 'invalid_token',
      }
    }

    const tokenHash = await hashEmailChangeToken(token)
    return await ctx.runMutation(
      internal.emailChangeInternal.verifyEmailChangeToken,
      {
        tokenHash,
        now: Date.now(),
      },
    )
  },
})
