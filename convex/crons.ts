import { cronJobs } from 'convex/server'
import { createCleanupTaskErrorsMutation } from 'ts-common/task-errors/convex'

import { components, internal } from './_generated/api'
import { internalMutation } from './_generated/server'

const crons = cronJobs()

crons.interval(
  'glotcap:cleanup-resend',
  { hours: 1 },
  internal.crons.cleanupResend,
)

crons.interval(
  'glotcap:cleanup-task-errors',
  { hours: 24 },
  internal.crons.cleanupTaskErrors,
)

export default crons

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export const cleanupResend = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {
      olderThan: ONE_WEEK_MS,
    })
    await ctx.scheduler.runAfter(
      0,
      components.resend.lib.cleanupAbandonedEmails,
      {
        olderThan: 4 * ONE_WEEK_MS,
      },
    )
  },
})

export const cleanupTaskErrors = createCleanupTaskErrorsMutation(
  internalMutation,
  {
    retentionMs: NINETY_DAYS_MS,
  },
)
