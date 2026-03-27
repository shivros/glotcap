import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import {
  isLanguageId,
  languageIdFromTargetLanguage,
} from '../shared/language-contract'
import { mutation, query } from './_generated/server'
import type { DatabaseReader, DatabaseWriter } from './_generated/server'
import type { Id } from './_generated/dataModel'

const normalizeLanguageId = (value: string | null | undefined) => {
  return isLanguageId(value) ? value : null
}

const getLatestPreferenceForUser = async (
  db: DatabaseReader | DatabaseWriter,
  userId: Id<'users'>,
) => {
  const rows = await db
    .query('userPreferences')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  if (rows.length === 0) {
    return { latest: null, staleIds: [] as Array<(typeof rows)[number]['_id']> }
  }

  const sortedRows = rows
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
  const [latest, ...staleRows] = sortedRows
  return {
    latest,
    staleIds: staleRows.map((row) => row._id),
  }
}

export const getMyLanguagePreference = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return { languageId: null as string | null, isAuthenticated: false }
    }

    const { latest: existing } = await getLatestPreferenceForUser(
      ctx.db,
      userId,
    )

    const storedLanguageId = normalizeLanguageId(
      existing?.lastSelectedLanguageId,
    )
    if (storedLanguageId) {
      return { languageId: storedLanguageId, isAuthenticated: true }
    }

    const latestSession = await ctx.db
      .query('speakingSessions')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(1)
    const inferredLanguageId = languageIdFromTargetLanguage(
      latestSession[0]?.targetLanguage,
    )

    return { languageId: inferredLanguageId, isAuthenticated: true }
  },
})

export const setMyLanguagePreference = mutation({
  args: {
    languageId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      })
    }

    const languageId = normalizeLanguageId(args.languageId)
    if (!languageId) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Unsupported language.',
      })
    }

    const now = Date.now()
    const { latest: existing, staleIds } = await getLatestPreferenceForUser(
      ctx.db,
      userId,
    )

    for (const staleId of staleIds) {
      await ctx.db.delete(staleId)
    }

    if (!existing) {
      await ctx.db.insert('userPreferences', {
        userId,
        lastSelectedLanguageId: languageId,
        createdAt: now,
        updatedAt: now,
      })
      return { languageId, updatedAt: now }
    }

    if (existing.lastSelectedLanguageId !== languageId) {
      await ctx.db.patch(existing._id, {
        lastSelectedLanguageId: languageId,
        updatedAt: now,
      })
      return { languageId, updatedAt: now }
    }

    return { languageId, updatedAt: existing.updatedAt }
  },
})
