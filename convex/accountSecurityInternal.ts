import { v } from 'convex/values'
import { internalQuery } from './_generated/server'

export const getPasswordAccountByUser = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const passwordAccount = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) =>
        q.eq('userId', args.userId).eq('provider', 'password'),
      )
      .unique()

    if (!passwordAccount) {
      return null
    }

    return {
      providerAccountId: passwordAccount.providerAccountId,
    }
  },
})
