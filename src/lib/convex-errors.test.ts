import { describe, expect, it } from 'vitest'
import {
  getGlotcapConvexFallbackMessage,
  normalizeGlotcapConvexError,
  toGlotcapConvexErrorMessage,
} from './convex-errors'
import type { GlotcapConvexErrorScope } from './convex-errors'

describe('glotcap convex errors', () => {
  it('maps known convex code to friendly copy', () => {
    const normalized = normalizeGlotcapConvexError({
      data: {
        code: 'EMAIL_CHANGE_ALREADY_PENDING',
        message: 'raw',
      },
    })

    expect(normalized.message).toBe(
      'That email already has a pending verification request.',
    )
    expect(normalized.known).toBe(true)
  })

  it('maps password reset rate-limit code to friendly copy', () => {
    const message = toGlotcapConvexErrorMessage(
      {
        data: {
          code: 'PASSWORD_RESET_RATE_LIMITED',
          message: 'raw',
        },
      },
      'account.password.reset.request',
    )
    expect(message).toBe('Please wait before requesting another reset email.')
  })

  it('falls back for opaque convex runtime errors', () => {
    const message = toGlotcapConvexErrorMessage(
      new Error(
        '[CONVEX A(passwordReset:requestPasswordReset)] [Request ID: abc] Server Error Called by client',
      ),
      'account.password.reset.request',
    )

    expect(message).toBe('Unable to send reset email.')
  })

  it('resolves scoped fallback messages from policy', () => {
    const expectations: Record<GlotcapConvexErrorScope, string> = {
      default: 'Something went wrong. Please try again.',
      'account.emailChange.request': 'Unable to request email change.',
      'account.emailChange.resend': 'Unable to resend verification email.',
      'account.emailChange.cancel': 'Unable to cancel email change.',
      'account.emailChange.verify': 'Unable to verify your email change.',
      'account.password.change': 'Unable to change your password.',
      'account.password.reset.request': 'Unable to send reset email.',
      'account.password.reset.submit': 'Unable to reset your password.',
    }

    for (const [scope, expected] of Object.entries(expectations)) {
      expect(
        getGlotcapConvexFallbackMessage(scope as GlotcapConvexErrorScope),
      ).toBe(expected)
    }
  })

  it('applies scoped fallback through helper for all password reset scopes', () => {
    const opaque = new Error(
      '[CONVEX A(any:fn)] [Request ID: xyz] Server Error Called by client',
    )
    const scopes: Array<GlotcapConvexErrorScope> = [
      'account.password.reset.request',
      'account.password.reset.submit',
    ]

    for (const scope of scopes) {
      expect(toGlotcapConvexErrorMessage(opaque, scope)).toBe(
        getGlotcapConvexFallbackMessage(scope),
      )
    }
  })
})
