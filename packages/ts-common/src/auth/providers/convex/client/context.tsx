'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useConvexAuth } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'

import { GenericAuthContext } from '../../../core/context'
import type { ReactNode } from 'react'
import type {
  AuthResult,
  IAuthContext,
  IAuthUser,
} from '../../../core/interfaces'
import type { ConvexAuthContextValue } from '../types'

const ConvexAuthContext = createContext<ConvexAuthContextValue | null>(null)

interface ConvexAuthBridgeProviderProps {
  children: ReactNode
  user: IAuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<unknown>
  error?: Error | null
  hasPasswordAuth?: boolean
  hasOAuthAuth?: boolean
}

interface ConvexAuthProviderProps {
  children: ReactNode
  /** Optional Convex API object for future user queries */
  api?: unknown
}

const toAuthResult = async (
  action: () => Promise<unknown>,
): Promise<AuthResult> => {
  try {
    await action()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auth action failed',
    }
  }
}

export function ConvexAuthBridgeProvider({
  children,
  user,
  isLoading,
  isAuthenticated,
  signOut,
  error = null,
  hasPasswordAuth = true,
  hasOAuthAuth = false,
}: ConvexAuthBridgeProviderProps) {
  const signOutAction = useCallback(() => toAuthResult(signOut), [signOut])

  const value = useMemo<ConvexAuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      signOut: signOutAction,
      hasPasswordAuth,
      hasOAuthAuth,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      error,
      signOutAction,
      hasPasswordAuth,
      hasOAuthAuth,
    ],
  )

  const genericValue = useMemo<IAuthContext>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      signOut: signOutAction,
    }),
    [user, isLoading, isAuthenticated, error, signOutAction],
  )

  return (
    <ConvexAuthContext.Provider value={value}>
      <GenericAuthContext.Provider value={genericValue}>
        {children}
      </GenericAuthContext.Provider>
    </ConvexAuthContext.Provider>
  )
}

/**
 * Convex auth provider that bridges Convex auth state into the generic context.
 */
export function ConvexAuthProvider({ children }: ConvexAuthProviderProps) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()

  // TODO: Wire a user query once available.
  const user: IAuthUser | null = null

  return (
    <ConvexAuthBridgeProvider
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      user={user}
      signOut={signOut}
    >
      {children}
    </ConvexAuthBridgeProvider>
  )
}

export function useConvexAuthContext(): ConvexAuthContextValue {
  const context = useContext(ConvexAuthContext)
  if (!context) {
    throw new Error(
      'useConvexAuthContext must be used within a ConvexAuthProvider',
    )
  }
  return context
}
