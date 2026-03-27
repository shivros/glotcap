'use client'

import { createContext, useContext } from 'react'
import type { IAuthContext } from './interfaces'

/**
 * Generic auth context that works with any auth provider.
 *
 * This context provides the `IAuthContext` interface which is implemented
 * by both Supabase and Convex providers, enabling provider-agnostic code.
 *
 * Both providers should populate this context alongside their provider-specific
 * contexts to enable the generic hooks (useGenericUser, useGenericIsAuthenticated, etc.)
 */
export const GenericAuthContext = createContext<IAuthContext | null>(null)

/**
 * Access the generic auth context.
 *
 * This hook works with any auth provider that populates GenericAuthContext.
 * Use this for provider-agnostic code that only needs the common auth interface.
 *
 * @throws Error if used outside an AuthProvider
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { signOut, isAuthenticated } = useGenericAuthContext();
 *
 *   if (!isAuthenticated) return null;
 *
 *   return <button onClick={signOut}>Log Out</button>;
 * }
 * ```
 */
export function useGenericAuthContext(): IAuthContext {
  const context = useContext(GenericAuthContext)
  if (!context) {
    throw new Error('useGenericAuthContext must be used within an AuthProvider')
  }
  return context
}
