'use client'

import { useGenericAuthContext } from '../context'

/**
 * Provider-agnostic hook to check if user is authenticated.
 *
 * Works with any auth provider that implements GenericAuthContext
 * (Supabase, Convex, etc.).
 *
 * @example
 * ```tsx
 * function ProtectedContent() {
 *   const { isAuthenticated, isLoading } = useIsAuthenticated();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isAuthenticated) return <Redirect to="/login" />;
 *
 *   return <SecretContent />;
 * }
 * ```
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean
  isLoading: boolean
} {
  const { isAuthenticated, isLoading } = useGenericAuthContext()
  return { isAuthenticated, isLoading }
}
