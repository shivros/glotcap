import { defineTable } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { INVITE_CODE_LENGTH } from './utils'
import { generateInviteCode, hashInviteCode } from './crypto'
import { consumeSignupInviteOrThrow, validateSignupInvite } from './service'
import type {
  FunctionVisibility,
  GenericDataModel,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server'

const DEFAULT_INVITE_TTL_DAYS = 14
const INVITE_GENERATION_ATTEMPTS = 5

export const inviteTables = {
  signupInvites: defineTable({
    codeHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index('by_code_hash', ['codeHash'])
    .index('by_expires_at', ['expiresAt']),
}

const resolveExpiresAt = (expiresInDays?: number) => {
  const days = Number.isFinite(expiresInDays)
    ? Math.max(1, Math.floor(expiresInDays ?? DEFAULT_INVITE_TTL_DAYS))
    : DEFAULT_INVITE_TTL_DAYS
  return Date.now() + days * 24 * 60 * 60 * 1000
}

export const createSignupInviteMutation = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  mutation: MutationBuilder<TDataModel, TVisibility>,
) =>
  mutation({
    args: {
      expiresInDays: v.optional(v.number()),
    },
    handler: async (ctx: any, args: any) => {
      const now = Date.now()
      const expiresAt = resolveExpiresAt(args.expiresInDays)

      for (
        let attempt = 0;
        attempt < INVITE_GENERATION_ATTEMPTS;
        attempt += 1
      ) {
        const code = generateInviteCode(INVITE_CODE_LENGTH)
        const codeHash = await hashInviteCode(code)
        const existing = await ctx.db
          .query('signupInvites')
          .withIndex('by_code_hash', (q: any) => q.eq('codeHash', codeHash))
          .unique()

        if (existing) {
          continue
        }

        await ctx.db.insert('signupInvites', {
          codeHash,
          createdAt: now,
          expiresAt,
        })

        return { code, expiresAt }
      }

      throw new ConvexError({
        code: 'INVITE_GENERATION_FAILED',
        message: 'Unable to generate a unique signup code.',
      })
    },
  })

export const createValidateInviteQuery = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  query: QueryBuilder<TDataModel, TVisibility>,
) =>
  query({
    args: {
      code: v.string(),
    },
    handler: async (ctx: any, args: any) => {
      const result = await validateSignupInvite(ctx, args.code)
      if (!result.valid) {
        return {
          valid: false as const,
          reason: result.reason,
          message: result.message,
        }
      }

      return { valid: true as const, expiresAt: result.expiresAt }
    },
  })

export const createConsumeInviteMutation = <
  TDataModel extends GenericDataModel,
  TVisibility extends FunctionVisibility,
>(
  mutation: MutationBuilder<TDataModel, TVisibility>,
) =>
  mutation({
    args: {
      code: v.string(),
    },
    handler: async (ctx: any, args: any) => {
      return consumeSignupInviteOrThrow(ctx, args.code)
    },
  })
