import { v } from 'convex/values'
import { PASSWORD_RESET_CONSUMED } from 'ts-common/convex/password-reset'
import { internalMutation } from './_generated/server'
import { createPasswordResetMutationService } from './lib/passwordResetAdapters'

export const beginPasswordResetRequest = internalMutation({
  args: {
    email: v.string(),
    tokenHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const service = createPasswordResetMutationService(ctx)
    return await service.beginRequest({
      email: args.email,
      tokenHash: args.tokenHash,
      nowMs: args.now,
      expiresAt: args.expiresAt,
    })
  },
})

export const verifyAndPrepareReset = internalMutation({
  args: {
    tokenHash: v.string(),
    newPassword: v.string(),
    confirmPassword: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const service = createPasswordResetMutationService(ctx)
    return await service.preparePasswordReset({
      tokenHash: args.tokenHash,
      newPassword: args.newPassword,
      confirmPassword: args.confirmPassword,
      nowMs: args.now,
    })
  },
})

export const markResetConsumed = internalMutation({
  args: {
    requestId: v.id('passwordResetRequests'),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      status: PASSWORD_RESET_CONSUMED,
      consumedAt: args.now,
      updatedAt: args.now,
    })
  },
})
