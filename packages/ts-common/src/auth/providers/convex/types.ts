/**
 * Convex-specific type definitions.
 *
 * Re-exports core interfaces and defines Convex-specific types.
 */
import type {
  AuthResult,
  IAuthContext,
  IAuthState,
  IAuthUser,
  OAuthProvider,
  SignUpMetadata,
} from '../../core'

// Re-export core types
export type {
  IAuthUser,
  IAuthState,
  IAuthContext,
  AuthResult,
  OAuthProvider,
  SignUpMetadata,
}

/**
 * Convex auth context value.
 * Extends the base IAuthContext with Convex-specific methods.
 */
export interface ConvexAuthContextValue extends IAuthContext {
  /** Whether email/password auth is available */
  hasPasswordAuth: boolean
  /** Whether OAuth is available */
  hasOAuthAuth: boolean
}

/**
 * Return type for useConvexAuth hook.
 * Note: Convex auth has different method signatures than Supabase.
 */
export interface UseConvexAuthReturn {
  user: IAuthUser | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  /** Sign in with a provider (e.g., "password", "github", "google") */
  signIn: (
    provider: string,
    args?: Record<string, unknown>,
  ) => Promise<AuthResult>
  /** Sign out the current user */
  signOut: () => Promise<AuthResult>
}
