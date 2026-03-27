import { validatePasswordPolicy } from './password-policy'

function extractStringField(
  value: unknown,
  field: 'code' | 'name' | 'message',
): string | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'string' ? candidate : null
}

export function isInvalidCredentialsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = extractStringField(error, 'code')
  const name = extractStringField(error, 'name')
  const message = error.message.trim()

  if (code === 'INVALID_CREDENTIALS') {
    return true
  }

  if (name === 'InvalidCredentialsError') {
    return true
  }

  if (/^invalid credentials\b/i.test(message)) {
    return true
  }

  if (/^InvalidSecret$/i.test(message)) {
    return true
  }

  return false
}

export type PasswordChangeInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type PasswordChangeDomainErrorCode =
  | 'PASSWORD_CHANGE_NOT_AVAILABLE'
  | 'PASSWORD_CONFIRMATION_MISMATCH'
  | 'PASSWORD_UNCHANGED'
  | 'PASSWORD_POLICY_VIOLATION'
  | 'INVALID_CURRENT_PASSWORD'

export class PasswordChangeDomainError extends Error {
  code: PasswordChangeDomainErrorCode

  constructor(code: PasswordChangeDomainErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export type VerifyCurrentPasswordResult = 'valid' | 'invalid' // pragma: allowlist secret

export type PasswordAuthGateway<TUserId, TSessionId = unknown> = {
  getPasswordAccountIdentifier: (userId: TUserId) => Promise<string | null>
  verifyCurrentPassword: (params: {
    userId: TUserId
    providerAccountId: string
    currentPassword: string
  }) => Promise<VerifyCurrentPasswordResult>
  updatePassword: (params: {
    providerAccountId: string
    newPassword: string
  }) => Promise<void>
  getCurrentSessionId: () => Promise<TSessionId | null>
  invalidateOtherSessions: (params: {
    userId: TUserId
    currentSessionId: TSessionId | null
  }) => Promise<void>
}

export async function changePasswordWithGateway<
  TUserId,
  TSessionId = unknown,
>(params: {
  userId: TUserId
  input: PasswordChangeInput
  gateway: PasswordAuthGateway<TUserId, TSessionId>
  validateNewPassword?: (password: string) => void
}) {
  const { userId, input, gateway } = params
  const validateNewPassword =
    params.validateNewPassword ?? validatePasswordPolicy

  const providerAccountId = await gateway.getPasswordAccountIdentifier(userId)
  if (!providerAccountId) {
    throw new PasswordChangeDomainError(
      'PASSWORD_CHANGE_NOT_AVAILABLE',
      'Password change is only available for email/password users.',
    )
  }

  if (input.newPassword !== input.confirmPassword) {
    throw new PasswordChangeDomainError(
      'PASSWORD_CONFIRMATION_MISMATCH',
      'New password and confirmation do not match.',
    )
  }

  if (input.currentPassword === input.newPassword) {
    throw new PasswordChangeDomainError(
      'PASSWORD_UNCHANGED',
      'New password must be different from your current password.',
    )
  }

  try {
    validateNewPassword(input.newPassword)
  } catch (error) {
    throw new PasswordChangeDomainError(
      'PASSWORD_POLICY_VIOLATION',
      error instanceof Error ? error.message : 'Password policy violation.',
    )
  }

  const verification = await gateway.verifyCurrentPassword({
    userId,
    providerAccountId,
    currentPassword: input.currentPassword,
  })

  if (verification !== 'valid') {
    throw new PasswordChangeDomainError(
      'INVALID_CURRENT_PASSWORD',
      'Current password is incorrect.',
    )
  }

  await gateway.updatePassword({
    providerAccountId,
    newPassword: input.newPassword,
  })

  const currentSessionId = await gateway.getCurrentSessionId()
  await gateway.invalidateOtherSessions({
    userId,
    currentSessionId,
  })

  return {
    status: 'password_changed' as const,
  }
}
