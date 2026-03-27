import {
  DEFAULT_CONVEX_ERROR_FALLBACK_MESSAGE,
  createConvexErrorCatalog,
  normalizeConvexUiError,
} from 'ts-common/convex/errors'
import type { NormalizeConvexUiErrorOptions } from 'ts-common/convex/errors'

const glotcapConvexErrorCatalog = createConvexErrorCatalog({
  EMAIL_UNCHANGED: 'New email must be different from your current email.',
  EMAIL_CHANGE_ALREADY_PENDING:
    'That email already has a pending verification request.',
  NO_PENDING_EMAIL_CHANGE: 'No pending email change request was found.',
  EMAIL_CHANGE_EXPIRED:
    'Your email change link has expired. Please request again.',
  EMAIL_CHANGE_RATE_LIMITED:
    'Please wait before requesting another verification email.',
  PASSWORD_CHANGE_NOT_AVAILABLE:
    'Password change is only available for email/password accounts.',
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect.', // pragma: allowlist secret
  PASSWORD_CONFIRMATION_MISMATCH: 'New password and confirmation do not match.', // pragma: allowlist secret
  PASSWORD_POLICY_VIOLATION: 'Password does not meet the requirements.', // pragma: allowlist secret
  PASSWORD_UNCHANGED:
    'New password must be different from your current password.',
  PASSWORD_RESET_RATE_LIMITED:
    'Please wait before requesting another reset email.',
})

export type GlotcapConvexErrorScope =
  | 'default'
  | 'account.emailChange.request'
  | 'account.emailChange.resend'
  | 'account.emailChange.cancel'
  | 'account.emailChange.verify'
  | 'account.password.change'
  | 'account.password.reset.request'
  | 'account.password.reset.submit'

const glotcapConvexFallbackMessages: Record<GlotcapConvexErrorScope, string> = {
  default: DEFAULT_CONVEX_ERROR_FALLBACK_MESSAGE,
  'account.emailChange.request': 'Unable to request email change.',
  'account.emailChange.resend': 'Unable to resend verification email.',
  'account.emailChange.cancel': 'Unable to cancel email change.',
  'account.emailChange.verify': 'Unable to verify your email change.',
  'account.password.change': 'Unable to change your password.',
  'account.password.reset.request': 'Unable to send reset email.',
  'account.password.reset.submit': 'Unable to reset your password.',
}

export function getGlotcapConvexFallbackMessage(
  scope: GlotcapConvexErrorScope,
) {
  return glotcapConvexFallbackMessages[scope]
}

type NormalizeGlotcapConvexErrorOptions = Omit<
  NormalizeConvexUiErrorOptions,
  'catalog'
> & {
  scope?: GlotcapConvexErrorScope
}

export function normalizeGlotcapConvexError(
  error: unknown,
  options: NormalizeGlotcapConvexErrorOptions = {},
) {
  const scope = options.scope ?? 'default'
  return normalizeConvexUiError(error, {
    fallbackMessage:
      options.fallbackMessage ?? getGlotcapConvexFallbackMessage(scope),
    catalog: glotcapConvexErrorCatalog,
  })
}

export function toGlotcapConvexErrorMessage(
  error: unknown,
  scope: GlotcapConvexErrorScope,
) {
  return normalizeGlotcapConvexError(error, {
    scope,
  }).message
}
