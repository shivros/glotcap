/**
 * Core authentication interfaces, types, and provider-agnostic utilities.
 * Used by both Supabase and Convex implementations.
 */

// Interfaces
export type {
  IAuthUser,
  IAuthState,
  IAuthActions,
  IPasswordAuthActions,
  IOAuthActions,
  ISessionActions,
  IAuthContext,
  IFullAuthContext,
  IAuthClient,
  AuthResult,
  OAuthProvider,
  SignUpMetadata,
} from './interfaces'

// Generic context (works with any provider)
export { GenericAuthContext, useGenericAuthContext } from './context'

// Provider-agnostic hooks
export { useUser, useIsAuthenticated, useSignOut } from './hooks'
