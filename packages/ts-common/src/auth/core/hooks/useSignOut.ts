'use client'

import { useGenericAuthContext } from '../context'
import type { AuthResult } from '../interfaces'

/**
 * Provider-agnostic hook to get the sign out function.
 *
 * Works with any auth provider that implements GenericAuthContext
 * (Supabase, Convex, etc.).
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { signOut } = useSignOut();
 *
 *   const handleLogout = async () => {
 *     const { success, error } = await signOut();
 *     if (success) {
 *       // Navigate to login
 *     } else {
 *       console.error(error);
 *     }
 *   };
 *
 *   return <button onClick={handleLogout}>Log Out</button>;
 * }
 * ```
 */
export function useSignOut(): {
  signOut: () => Promise<AuthResult>
} {
  const { signOut } = useGenericAuthContext()
  return { signOut }
}
