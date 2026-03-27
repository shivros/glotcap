'use client'

import { useGenericAuthContext } from '../context'
import type { IAuthUser } from '../interfaces'

/**
 * Provider-agnostic hook to get the current user.
 *
 * Works with any auth provider that implements GenericAuthContext
 * (Supabase, Convex, etc.).
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const { user, isLoading } = useUser();
 *
 *   if (isLoading) return <Loading />;
 *   if (!user) return <LoginPrompt />;
 *
 *   return <div>Hello, {user.email}</div>;
 * }
 * ```
 */
export function useUser(): {
  user: IAuthUser | null
  isLoading: boolean
  error: Error | null
} {
  const { user, isLoading, error } = useGenericAuthContext()
  return { user, isLoading, error }
}
