import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type {
  FunctionVisibility,
  GenericDataModel,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server'

export type ListTaskErrorsOptions = {
  allowInProd?: boolean
  maxLimit?: number
  getUserId?: (ctx: any) => Promise<string | null> | string | null
}

export type CleanupTaskErrorsOptions = {
  retentionMs?: number
  batchSize?: number
  maxBatches?: number
}

const DEFAULT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const DEFAULT_BATCH_SIZE = 200
const DEFAULT_MAX_BATCHES = 10

const isDevtoolsEnabled = (allowInProd?: boolean) => {
  if (allowInProd) return true
  if (process.env.DEVTOOLS_ENABLED === 'true') return true
  const deployment = process.env.CONVEX_DEPLOYMENT
  if (
    deployment?.startsWith('dev:') ||
    deployment?.startsWith('local') ||
    deployment?.startsWith('localhost')
  ) {
    return true
  }
  return process.env.NODE_ENV !== 'production'
}

export const taskErrorTables = {
  taskErrors: defineTable({
    task_id: v.id('tasks'),
    user_id: v.id('users'),
    error_message: v.string(),
    error_detail: v.optional(v.string()),
    created_at: v.number(),
  })
    .index('by_task', ['task_id'])
    .index('by_user', ['user_id'])
    .index('by_created_at', ['created_at'])
    .index('by_user_created_at', ['user_id', 'created_at']),
}

export const createListTaskErrorsQuery = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  query: QueryBuilder<TDataModel, TVisibility>,
  options: ListTaskErrorsOptions = {},
) =>
  query({
    args: {
      limit: v.optional(v.number()),
    },
    handler: async (ctx: any, args: any) => {
      if (!isDevtoolsEnabled(options.allowInProd)) {
        return []
      }

      const limit = Math.min(args.limit ?? 50, options.maxLimit ?? 200)

      if (options.getUserId) {
        const userId = await options.getUserId(ctx)
        if (!userId) return []
        return ctx.db
          .query('taskErrors')
          .withIndex('by_user_created_at', (q: any) => q.eq('user_id', userId))
          .order('desc')
          .take(limit)
      }

      return ctx.db
        .query('taskErrors')
        .withIndex('by_created_at')
        .order('desc')
        .take(limit)
    },
  })

export const createCleanupTaskErrorsMutation = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  mutation: MutationBuilder<TDataModel, TVisibility>,
  options: CleanupTaskErrorsOptions = {},
) =>
  mutation({
    args: {
      olderThan: v.optional(v.number()),
      batchSize: v.optional(v.number()),
      maxBatches: v.optional(v.number()),
    },
    handler: async (ctx: any, args: any) => {
      const retentionMs = Math.max(
        args.olderThan ?? options.retentionMs ?? DEFAULT_RETENTION_MS,
        0,
      )
      const batchSize = Math.min(
        args.batchSize ?? options.batchSize ?? DEFAULT_BATCH_SIZE,
        500,
      )
      const maxBatches = Math.min(
        args.maxBatches ?? options.maxBatches ?? DEFAULT_MAX_BATCHES,
        50,
      )

      const cutoff = Date.now() - retentionMs
      let deleted = 0

      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const batch = await ctx.db
          .query('taskErrors')
          .withIndex('by_created_at', (q: any) => q.lt('created_at', cutoff))
          .take(batchSize)

        if (batch.length === 0) break

        for (const entry of batch) {
          await ctx.db.delete(entry._id)
        }

        deleted += batch.length
        if (batch.length < batchSize) break
      }

      return { deleted }
    },
  })
