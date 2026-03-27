/**
 * Provider-agnostic authentication interfaces.
 *
 * These interfaces follow SOLID principles:
 * - Single Responsibility: Each interface has one purpose
 * - Interface Segregation: Small, focused interfaces that can be composed
 * - Dependency Inversion: Components depend on these abstractions, not concrete providers
 */

/**
 * Provider-agnostic user representation.
 * Maps to both Supabase User and Convex Identity.
 */
export interface IAuthUser {
  /** Unique identifier for the user */
  id: string
  /** User's email address (may be null for some auth methods) */
  email?: string | null
  /** Whether the user's email has been verified */
  emailVerified?: boolean
  /** Additional user metadata */
  metadata?: Record<string, unknown>
}

/**
 * Authentication state (read-only).
 * Represents the current state of authentication.
 */
export interface IAuthState {
  /** Currently authenticated user, or null if not authenticated */
  user: IAuthUser | null
  /** Whether auth state is being loaded/checked */
  isLoading: boolean
  /** Whether user is currently authenticated */
  isAuthenticated: boolean
  /** Any error that occurred during auth operations */
  error: Error | null
}

/**
 * Core authentication actions that all providers must support.
 */
export interface IAuthActions {
  /** Sign out the current user */
  signOut: () => Promise<AuthResult>
}

/**
 * Password-based authentication actions.
 * Optional capability - not all providers support this.
 */
export interface IPasswordAuthActions {
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<AuthResult>
  /** Create a new account with email and password */
  signUp: (
    email: string,
    password: string,
    metadata?: SignUpMetadata,
    emailRedirectTo?: string,
  ) => Promise<AuthResult>
  /** Send a password reset email */
  resetPassword: (email: string, redirectTo?: string) => Promise<AuthResult>
  /** Update the current user's password */
  updatePassword: (newPassword: string) => Promise<AuthResult>
  /** Update the current user's email */
  updateEmail: (newEmail: string) => Promise<AuthResult>
}

/**
 * OAuth authentication actions.
 * Optional capability for providers supporting OAuth.
 */
export interface IOAuthActions {
  /** Sign in with an OAuth provider */
  signInWithProvider: (
    provider: OAuthProvider,
    redirectTo?: string,
  ) => Promise<AuthResult>
}

/**
 * Session management actions.
 * Supabase-specific - Convex uses a different model.
 */
export interface ISessionActions {
  /** Refresh the current session */
  refreshSession: () => Promise<void>
}

/**
 * Base auth context - state + core actions.
 * This is the minimum interface all providers implement.
 */
export interface IAuthContext extends IAuthState, IAuthActions {}

/**
 * Full auth context with all authentication methods.
 * Used by providers that support password + OAuth auth.
 */
export interface IFullAuthContext
  extends IAuthContext, IPasswordAuthActions, IOAuthActions {}

/**
 * Minimal auth client interface for route guards.
 * Allows route guards to work with any provider.
 */
export interface IAuthClient {
  getUser: () => Promise<{ user: IAuthUser | null; error: Error | null }>
}

/**
 * Result of an authentication operation.
 */
export interface AuthResult {
  /** Whether the operation succeeded */
  success: boolean
  /** Error message if the operation failed */
  error?: string
}

/**
 * Supported OAuth providers.
 */
export type OAuthProvider = 'github' | 'google' | 'apple'

/**
 * User metadata for sign up operations.
 */
export interface SignUpMetadata {
  username?: string
  full_name?: string
  [key: string]: unknown
}
