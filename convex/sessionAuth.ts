import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

/**
 * Requires the caller to be authenticated.
 * Returns the authenticated user's ID or throws UNAUTHORIZED.
 */
export const requireAuthUserId = async (
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> => {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    })
  }
  return userId
}

/**
 * Requires the caller to own the given session.
 * Returns the authenticated userId and the session document,
 * or throws UNAUTHORIZED / NOT_FOUND.
 */
export const requireOwnedSession = async (
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'speakingSessions'>,
): Promise<{ userId: Id<'users'>; session: Doc<'speakingSessions'> }> => {
  const userId = await requireAuthUserId(ctx)
  const session = await ctx.db.get(sessionId)
  if (!session || session.userId !== userId) {
    throw new ConvexError({
      code: 'NOT_FOUND',
      message: 'Session not found.',
    })
  }
  return { userId, session }
}
