/**
 * Client-side auth utilities for route protection with Convex.
 *
 * Note: Convex route guards work differently than Supabase.
 * These functions return empty objects and rely on client-side
 * React components (Authenticated/Unauthenticated) for protection.
 *
 * For server-side protection in Convex functions, use ctx.auth.getUserIdentity().
 */
/**
 * Redirect authenticated users away from auth pages.
 * Call this in beforeLoad on login/signup pages.
 *
 * Note: With Convex, this is a no-op in beforeLoad since we can't
 * check auth state synchronously. The actual redirect happens in the
 * component using the useConvexAuth hook.
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute('/login')({
 *   beforeLoad: redirectIfAuthenticated,
 *   component: LoginPage,
 * })
 * ```
 */
export function redirectIfAuthenticated() {
  // With Convex, we can't check auth state in beforeLoad synchronously
  // The redirect is handled in the component using useConvexAuth
  // This is kept for API compatibility
  return {}
}

/**
 * Require authentication for a route.
 *
 * Note: With Convex, auth checking happens client-side using useConvexAuth.
 * Use the Authenticated/Unauthenticated components or useConvexAuth hook
 * in your components to conditionally render content.
 *
 * @example
 * ```tsx
 * import { Authenticated, Unauthenticated } from '@convex-dev/auth/react'
 *
 * function ProtectedPage() {
 *   return (
 *     <>
 *       <Authenticated>
 *         <ProtectedContent />
 *       </Authenticated>
 *       <Unauthenticated>
 *         <Navigate to="/login" />
 *       </Unauthenticated>
 *     </>
 *   )
 * }
 * ```
 */
export function requireAuth() {
  // With Convex, auth is checked client-side
  // Protected routes should use the Authenticated component
  return {}
}

/**
 * Require authentication but allow unconfirmed emails.
 * With Convex, email confirmation is handled differently.
 */
export function requireAuthUnconfirmed() {
  return {}
}
