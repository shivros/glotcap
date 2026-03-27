import { ConvexError } from 'convex/values'
import { auth } from '../auth'

export async function requireUserId(ctx: Parameters<typeof auth.getUserId>[0]) {
  const userId = await auth.getUserId(ctx)
  if (!userId) {
    throw new ConvexError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
    })
  }
  return userId
}
