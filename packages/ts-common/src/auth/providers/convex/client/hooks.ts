'use client'

import { useConvexAuthContext } from './context'
import type { AuthResult, IAuthUser } from '../../../core'

/**
 * Get the current authenticated user.
 *
 * Note: Unlike Supabase, Convex auth doesn't automatically provide user details.
 * The user object comes from your app's user query.
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { user, isLoading } = useUser()
 *
 *   if (isLoading) return <Loading />
 *   if (!user) return <LoginPrompt />
 *
 *   return <div>Hello, {user.email}</div>
 * }
 * ```
 */
export function useUser(): {
  user: IAuthUser | null
  isLoading: boolean
  error: Error | null
} {
  const { user, isLoading, error } = useConvexAuthContext()
  return { user, isLoading, error }
}

/**
 * Get auth actions (sign out).
 *
 * Note: For sign in, use Convex's useAuthActions directly since
 * the method signatures differ from Supabase.
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { signOut } = useAuthActions()
 *   return <button onClick={signOut}>Log Out</button>
 * }
 * ```
 */
export function useAuthActions(): {
  signOut: () => Promise<AuthResult>
} {
  const { signOut } = useConvexAuthContext()
  return { signOut }
}

/**
 * Check if user is authenticated.
 *
 * @example
 * ```tsx
 * function ProtectedContent() {
 *   const { isAuthenticated, isLoading } = useIsAuthenticated()
 *
 *   if (isLoading) return <Loading />
 *   if (!isAuthenticated) return <Redirect to="/login" />
 *
 *   return <SecretContent />
 * }
 * ```
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean
  isLoading: boolean
} {
  const { isAuthenticated, isLoading } = useConvexAuthContext()
  return { isAuthenticated, isLoading }
}
