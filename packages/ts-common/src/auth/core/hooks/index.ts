/**
 * Provider-agnostic auth hooks.
 *
 * These hooks work with any auth provider that implements GenericAuthContext,
 * enabling provider-independent code.
 *
 * @example
 * ```tsx
 * // Works with both Supabase and Convex
 * import { useUser, useIsAuthenticated, useSignOut } from 'ts-common/auth/core/hooks';
 *
 * function App() {
 *   const { user } = useUser();
 *   const { isAuthenticated } = useIsAuthenticated();
 *   const { signOut } = useSignOut();
 *   // ...
 * }
 * ```
 */

export { useUser } from './useUser'
export { useIsAuthenticated } from './useIsAuthenticated'
export { useSignOut } from './useSignOut'
