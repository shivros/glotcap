'use client'

import { useCallback } from 'react'
import { useAuthActions as useConvexAuthActions } from '@convex-dev/auth/react'
import { normalizeConvexUiError } from '../../../../convex/errors'
import type { AppError } from '../../../../logging/errors'

const DEFAULT_AUTH_ERROR_MESSAGE = 'Authentication failed.'
const DEFAULT_SIGNIN_ERROR_MESSAGE = 'Failed to sign in.'
const DEFAULT_SIGNUP_ERROR_MESSAGE = 'Unable to sign up.'
const DEFAULT_OAUTH_ERROR_MESSAGE = 'OAuth sign in failed.'
const DEFAULT_INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials.'
const DEFAULT_RATE_LIMITED_MESSAGE =
  'Too many failed attempts. Please try again later.'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const inferFallbackMessage = (provider: unknown, params: unknown): string => {
  if (provider === 'password') {
    if (isRecord(params) && params.flow === 'signUp') {
      return DEFAULT_SIGNUP_ERROR_MESSAGE
    }
    return DEFAULT_SIGNIN_ERROR_MESSAGE
  }

  if (typeof provider === 'string' && provider.length > 0) {
    return DEFAULT_OAUTH_ERROR_MESSAGE
  }

  return DEFAULT_AUTH_ERROR_MESSAGE
}

export type NormalizedConvexAuthError = Pick<
  AppError,
  'code' | 'message' | 'retryable'
>

export type NormalizeConvexAuthErrorOptions = {
  fallbackMessage?: string
  invalidCredentialsMessage?: string
  rateLimitedMessage?: string
}

export function normalizeConvexAuthError(
  error: unknown,
  options: NormalizeConvexAuthErrorOptions = {},
): NormalizedConvexAuthError {
  const fallbackMessage = options.fallbackMessage ?? DEFAULT_AUTH_ERROR_MESSAGE
  const invalidCredentialsMessage =
    options.invalidCredentialsMessage ?? DEFAULT_INVALID_CREDENTIALS_MESSAGE
  const rateLimitedMessage =
    options.rateLimitedMessage ?? DEFAULT_RATE_LIMITED_MESSAGE

  const appError = normalizeConvexUiError(error, {
    fallbackMessage,
  })

  const lowerMessage = appError.message.toLowerCase()
  if (
    appError.code === 'INVALID_CREDENTIALS' ||
    appError.code === 'INVALID_ACCOUNT' ||
    lowerMessage.includes('invalidsecret')
  ) {
    return {
      code: 'INVALID_CREDENTIALS',
      message: invalidCredentialsMessage,
      retryable: false,
    }
  }

  if (lowerMessage.includes('toomanyfailedattempts')) {
    return {
      code: 'AUTH_RATE_LIMITED',
      message: rateLimitedMessage,
      retryable: true,
    }
  }

  return {
    code: appError.code,
    message: appError.message,
    retryable: appError.retryable,
  }
}

export class ConvexAuthUiError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(
    normalized: NormalizedConvexAuthError,
    options: { cause?: unknown } = {},
  ) {
    super(normalized.message)
    this.name = 'ConvexAuthUiError'
    this.code = normalized.code
    this.retryable = normalized.retryable
    if (options.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

type ConvexAuthActions = ReturnType<typeof useConvexAuthActions>

function noopSignIn(): ReturnType<ConvexAuthActions['signIn']> {
  return Promise.resolve({ signingIn: false } as const)
}

function noopSignOut(): ReturnType<ConvexAuthActions['signOut']> {
  return Promise.resolve()
}

export function useSafeConvexAuthActions(): ConvexAuthActions {
  const actions = useConvexAuthActions()

  const rawSignIn = actions.signIn

  const signIn = useCallback(
    async (...args: Parameters<ConvexAuthActions['signIn']>) => {
      try {
        return await rawSignIn(...args)
      } catch (error) {
        const normalized = normalizeConvexAuthError(error, {
          fallbackMessage: inferFallbackMessage(args[0], args[1]),
        })
        throw new ConvexAuthUiError(normalized, { cause: error })
      }
    },
    [rawSignIn],
  ) as ConvexAuthActions['signIn']

  if (typeof window === 'undefined' && typeof actions.signIn !== 'function') {
    return {
      signIn: noopSignIn,
      signOut: noopSignOut,
    }
  }

  return {
    ...actions,
    signIn,
  }
}
