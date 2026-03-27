/**
 * Convex client-side auth exports.
 *
 * For Convex authentication, prefer these shared client utilities
 * so user-facing auth errors are normalized consistently.
 */
export { ConvexAuthBridgeProvider, useConvexAuthContext } from './context'
export { useUser, useAuthActions, useIsAuthenticated } from './hooks'
export {
  useSafeConvexAuthActions,
  normalizeConvexAuthError,
  ConvexAuthUiError,
} from './safe-actions'
export { StableConvexAuthProvider, useStableConvexAuthActions } from './stable'
export type {
  IAuthUser,
  IAuthContext,
  AuthResult,
  OAuthProvider,
  SignUpMetadata,
  ConvexAuthContextValue,
  UseConvexAuthReturn,
} from '../types'
