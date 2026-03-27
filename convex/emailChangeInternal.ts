import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { createEmailChangeMutationService } from './lib/emailChangeAdapters'
import { requireUserId } from './lib/requireUserId'

export const beginEmailChangeRequest = internalMutation({
  args: {
    newEmail: v.string(),
    tokenHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const service = createEmailChangeMutationService(ctx)
    return await service.beginRequestForUser(userId, {
      newEmailInput: args.newEmail,
      tokenHash: args.tokenHash,
      nowMs: args.now,
      expiresAt: args.expiresAt,
    })
  },
})

export const resendEmailChangeRequest = internalMutation({
  args: {
    tokenHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const service = createEmailChangeMutationService(ctx)
    return await service.resendRequestForUser(userId, {
      tokenHash: args.tokenHash,
      nowMs: args.now,
      expiresAt: args.expiresAt,
    })
  },
})

export const verifyEmailChangeToken = internalMutation({
  args: {
    tokenHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const service = createEmailChangeMutationService(ctx)
    return await service.verifyTokenHash({
      tokenHash: args.tokenHash,
      nowMs: args.now,
    })
  },
})
