'use client'

import {
  ConvexAuthProvider as RawConvexAuthProvider,
  useAuthActions as useRawConvexAuthActions,
} from '@convex-dev/auth/react'
import { createContext, useContext } from 'react'
import type { ComponentProps, ReactNode } from 'react'

type RawConvexAuthActions = ReturnType<typeof useRawConvexAuthActions>

const StableConvexAuthActionsContext =
  createContext<RawConvexAuthActions | null>(null)

const noopSignIn = () => Promise.resolve({ signingIn: false } as const)
const noopSignOut = () => Promise.resolve(undefined)

function StableActionsBridge({ children }: { children: ReactNode }) {
  const actions = useRawConvexAuthActions()
  return (
    <StableConvexAuthActionsContext.Provider value={actions}>
      {children}
    </StableConvexAuthActionsContext.Provider>
  )
}

export type StableConvexAuthProviderProps = ComponentProps<
  typeof RawConvexAuthProvider
>

/**
 * Wraps ConvexAuthProvider and re-exposes auth actions through a stable app-level context.
 *
 * This avoids runtime crashes when bundling creates multiple @convex-dev/auth
 * module instances and hook/provider contexts become mismatched.
 */
export function StableConvexAuthProvider({
  children,
  ...props
}: StableConvexAuthProviderProps) {
  return (
    <RawConvexAuthProvider {...props}>
      <StableActionsBridge>{children}</StableActionsBridge>
    </RawConvexAuthProvider>
  )
}

export function useStableConvexAuthActions(): RawConvexAuthActions {
  const actions = useContext(StableConvexAuthActionsContext)
  if (
    actions &&
    typeof actions.signIn === 'function' &&
    typeof actions.signOut === 'function'
  ) {
    return actions
  }

  return {
    signIn: noopSignIn,
    signOut: noopSignOut,
  }
}
