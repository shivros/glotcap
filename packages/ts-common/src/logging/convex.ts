import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type {
  FunctionVisibility,
  GenericDataModel,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server'

export const loggingTables = {
  appLogs: defineTable({
    level: v.string(),
    code: v.optional(v.string()),
    message: v.string(),
    source: v.optional(v.string()),
    context: v.optional(v.any()),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_entity', ['entityId']),
}

export const createLogEventMutation = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  mutation: MutationBuilder<TDataModel, TVisibility>,
) =>
  mutation({
    args: {
      level: v.optional(v.string()),
      code: v.optional(v.string()),
      message: v.string(),
      source: v.optional(v.string()),
      context: v.optional(v.any()),
      entityId: v.optional(v.string()),
      entityType: v.optional(v.string()),
      sessionId: v.optional(v.string()),
    },
    handler: async (ctx: any, args: any) => {
      const now = Date.now()
      const entityId = args.entityId ?? args.sessionId
      const entityType =
        args.entityType ?? (args.sessionId ? 'session' : undefined)
      await ctx.db.insert('appLogs', {
        level: args.level ?? 'error',
        code: args.code,
        message: args.message,
        source: args.source,
        context: args.context,
        entityId,
        entityType,
        sessionId: args.sessionId,
        createdAt: now,
      })
    },
  })

export const createListRecentQuery = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  query: QueryBuilder<TDataModel, TVisibility>,
) =>
  query({
    args: {
      limit: v.optional(v.number()),
    },
    handler: (ctx: any, args: any) => {
      const limit = Math.min(args.limit ?? 50, 200)
      return ctx.db
        .query('appLogs')
        .withIndex('by_createdAt')
        .order('desc')
        .take(limit)
    },
  })
