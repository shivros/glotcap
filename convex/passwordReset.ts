import {
  invalidateSessions,
  modifyAccountCredentials,
} from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import {
  generateEmailChangeToken,
  hashEmailChangeToken,
  normalizeAuthEmail,
} from 'ts-common/convex/email-change'
import {
  DEFAULT_PASSWORD_RESET_PATH,
  PASSWORD_RESET_REQUEST_TTL_MS,
  buildPasswordResetLink,
  resolvePasswordResetExpiry,
} from 'ts-common/convex/password-reset'
import {
  requestPasswordResetWithPorts,
  resetPasswordWithPorts,
} from 'ts-common/convex/password-reset-action-service'
import { buildDefaultPasswordResetTemplate } from 'ts-common/convex/password-reset-service'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { resend } from './emails'
import type {
  RequestPasswordResetPorts,
  RequestPasswordResetResult,
  ResetPasswordPorts,
  ResetPasswordResult,
} from 'ts-common/convex/password-reset-action-service'
import type { Id } from './_generated/dataModel'

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

export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<RequestPasswordResetResult> => {
    const ports: RequestPasswordResetPorts<typeof ctx> = {
      normalizeEmail: normalizeAuthEmail,
      createToken: generateEmailChangeToken,
      hashToken: hashEmailChangeToken,
      now: () => Date.now(),
      resolveExpiry: resolvePasswordResetExpiry,
      ttlMs: PASSWORD_RESET_REQUEST_TTL_MS,
      beginPasswordResetRequest: (params) =>
        ctx.runMutation(
          internal.passwordResetInternal.beginPasswordResetRequest,
          {
            email: params.email,
            tokenHash: params.tokenHash,
            now: params.now,
            expiresAt: params.expiresAt,
          },
        ),
      buildResetLink: (token) =>
        buildPasswordResetLink({
          siteUrl: requireSiteUrl(),
          token,
          path: DEFAULT_PASSWORD_RESET_PATH,
        }),
      buildEmailTemplate: ({ resetUrl, expiresAt }) =>
        buildDefaultPasswordResetTemplate({
          appName: APP_NAME,
          resetUrl,
          expiresAt,
        }),
      sendResetEmail: async (actionCtx, params) => {
        await resend.sendEmail(actionCtx, {
          from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        })
      },
    }

    return await requestPasswordResetWithPorts(ports, {
      actionCtx: ctx,
      emailInput: args.email,
    })
  },
})

export const resetPassword = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
    confirmPassword: v.string(),
  },
  handler: async (ctx, args): Promise<ResetPasswordResult> => {
    const ports: ResetPasswordPorts<
      typeof ctx,
      Id<'users'>,
      Id<'passwordResetRequests'>
    > = {
      hashToken: hashEmailChangeToken,
      now: () => Date.now(),
      verifyAndPrepareReset: (params) =>
        ctx.runMutation(internal.passwordResetInternal.verifyAndPrepareReset, {
          tokenHash: params.tokenHash,
          newPassword: params.newPassword,
          confirmPassword: params.confirmPassword,
          now: params.now,
        }),
      updatePassword: (actionCtx, params) =>
        modifyAccountCredentials(actionCtx, {
          provider: 'password',
          account: {
            id: params.providerAccountId,
            secret: params.newPassword,
          },
        }),
      invalidateSessions: (actionCtx, params) =>
        invalidateSessions(actionCtx, {
          userId: params.userId,
        }),
      markResetConsumed: (params) =>
        ctx.runMutation(internal.passwordResetInternal.markResetConsumed, {
          requestId: params.requestId,
          now: params.now,
        }),
    }

    return await resetPasswordWithPorts(ports, {
      actionCtx: ctx,
      tokenInput: args.token,
      newPassword: args.newPassword,
      confirmPassword: args.confirmPassword,
    })
  },
})
