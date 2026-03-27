import type { IAuthUser } from '../../../core'

/**
 * Generic context type for Convex query/mutation handlers.
 * This matches Convex's GenericQueryCtx pattern.
 */
interface ConvexAuthContext {
  auth: {
    getUserIdentity: () => Promise<{
      subject: string
      email?: string
      emailVerified?: boolean
      name?: string
      pictureUrl?: string
      tokenIdentifier: string
    } | null>
  }
}

/**
 * Require an authenticated user in a Convex function.
 *
 * Use this in Convex queries/mutations to enforce authentication.
 *
 * @example
 * ```ts
 * import { query } from "./_generated/server";
 * import { requireConvexUser } from "ts-common/auth/providers/convex/server";
 *
 * export const getMyProfile = query({
 *   handler: async (ctx) => {
 *     const user = await requireConvexUser(ctx);
 *     // user is guaranteed to be authenticated here
 *     return { userId: user.id, email: user.email };
 *   },
 * });
 * ```
 */
export async function requireConvexUser(
  ctx: ConvexAuthContext,
): Promise<IAuthUser> {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    throw new Error('Unauthorized: Authentication required')
  }

  return {
    id: identity.subject,
    email: identity.email,
    emailVerified: identity.emailVerified ?? false,
    metadata: {
      name: identity.name,
      pictureUrl: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
    },
  }
}

/**
 * Get current user if authenticated, or null if not.
 *
 * Use this in Convex functions when auth is optional.
 *
 * @example
 * ```ts
 * import { query } from "./_generated/server";
 * import { getConvexUser } from "ts-common/auth/providers/convex/server";
 *
 * export const getContent = query({
 *   handler: async (ctx) => {
 *     const user = await getConvexUser(ctx);
 *
 *     if (user) {
 *       return { message: `Hello, ${user.email}` };
 *     }
 *     return { message: "Hello, anonymous" };
 *   },
 * });
 * ```
 */
export async function getConvexUser(
  ctx: ConvexAuthContext,
): Promise<IAuthUser | null> {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    return null
  }

  return {
    id: identity.subject,
    email: identity.email,
    emailVerified: identity.emailVerified ?? false,
    metadata: {
      name: identity.name,
      pictureUrl: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
    },
  }
}
