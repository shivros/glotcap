import { ConvexError } from 'convex/values'
import { hashInviteCode } from './crypto'
import { isInviteCodeFormatValid, normalizeInviteCode } from './utils'

export type InviteInvalidReason =
  | 'invalid_format'
  | 'not_found'
  | 'consumed'
  | 'expired'

export type InviteValidationResult =
  | {
      valid: true
      expiresAt: number
      normalizedCode: string
      invite: SignupInviteRecord
    }
  | {
      valid: false
      reason: InviteInvalidReason
      message: string
    }

type SignupInviteRecord = {
  _id: unknown
  codeHash: string
  expiresAt: number
  consumedAt?: number
}

type EqBuilder = {
  eq: (field: string, value: string) => EqBuilder
}

export type InviteStore = {
  query: (table: string) => {
    withIndex: (
      index: string,
      callback: (q: EqBuilder) => EqBuilder | void,
    ) => {
      unique: () => Promise<SignupInviteRecord | null>
    }
  }
  patch: (
    id: unknown,
    updates: {
      consumedAt: number
    },
  ) => Promise<unknown>
}

export type InviteStoreCtx = {
  db: InviteStore
}

const INVALID_FORMAT_MESSAGE = 'Enter the 8-character signup code.'
const NOT_FOUND_MESSAGE = 'That signup code is not valid.'
const CONSUMED_MESSAGE = 'That signup code has already been used.'
const EXPIRED_MESSAGE = 'That signup code has expired.'

export function normalizeAndValidateInviteCode(code: string) {
  const normalizedCode = normalizeInviteCode(code)
  return {
    normalizedCode,
    isValidFormat: isInviteCodeFormatValid(normalizedCode),
  }
}

export async function validateSignupInvite(
  ctx: InviteStoreCtx,
  code: string,
): Promise<InviteValidationResult> {
  const { normalizedCode, isValidFormat } = normalizeAndValidateInviteCode(code)
  if (!isValidFormat) {
    return {
      valid: false,
      reason: 'invalid_format',
      message: INVALID_FORMAT_MESSAGE,
    }
  }

  const codeHash = await hashInviteCode(normalizedCode)
  const invite = await ctx.db
    .query('signupInvites')
    .withIndex('by_code_hash', (q) => q.eq('codeHash', codeHash))
    .unique()

  if (!invite) {
    return {
      valid: false,
      reason: 'not_found',
      message: NOT_FOUND_MESSAGE,
    }
  }

  if (invite.consumedAt) {
    return {
      valid: false,
      reason: 'consumed',
      message: CONSUMED_MESSAGE,
    }
  }

  if (invite.expiresAt <= Date.now()) {
    return {
      valid: false,
      reason: 'expired',
      message: EXPIRED_MESSAGE,
    }
  }

  return {
    valid: true,
    expiresAt: invite.expiresAt,
    normalizedCode,
    invite,
  }
}

export async function consumeSignupInviteOrThrow(
  ctx: InviteStoreCtx,
  code: string,
) {
  const validation = await validateSignupInvite(ctx, code)
  if (!validation.valid) {
    const codeByReason: Record<InviteInvalidReason, string> = {
      invalid_format: 'INVALID_INVITE',
      not_found: 'INVITE_NOT_FOUND',
      consumed: 'INVITE_CONSUMED',
      expired: 'INVITE_EXPIRED',
    }
    throw new ConvexError({
      code: codeByReason[validation.reason],
      message: validation.message,
    })
  }

  await ctx.db.patch(validation.invite._id, { consumedAt: Date.now() })

  return { ok: true as const }
}
