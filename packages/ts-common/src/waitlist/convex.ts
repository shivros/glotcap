import { defineTable } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { isWaitlistEmailValid, normalizeWaitlistEmail } from './utils'
import type {
  FunctionVisibility,
  GenericDataModel,
  MutationBuilder,
} from 'convex/server'

export const waitlistTables = {
  waitlistSignups: defineTable({
    email: v.string(),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_email', ['email']),
}

export const createJoinWaitlistMutation = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  mutation: MutationBuilder<TDataModel, TVisibility>,
) =>
  mutation({
    args: {
      email: v.string(),
      source: v.optional(v.string()),
    },
    handler: async (ctx: any, args: any) => {
      const email = normalizeWaitlistEmail(args.email)

      if (!isWaitlistEmailValid(email)) {
        throw new ConvexError({
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address.',
        })
      }

      const existing = await ctx.db
        .query('waitlistSignups')
        .withIndex('by_email', (q: any) => q.eq('email', email))
        .unique()

      const now = Date.now()

      if (existing) {
        await ctx.db.patch(existing._id, {
          updatedAt: now,
          source: existing.source ?? args.source,
        })
        return { status: 'existing' }
      }

      await ctx.db.insert('waitlistSignups', {
        email,
        source: args.source,
        createdAt: now,
        updatedAt: now,
      })

      return { status: 'joined' }
    },
  })
