import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const PASSWORD_RESET_REQUEST_TTL_MS = 60 * 60 * 1000 // 1 hour
export const PASSWORD_RESET_RATE_LIMIT_MS = 60 * 1000 // 60 seconds between requests
export const DEFAULT_PASSWORD_RESET_PATH = '/reset-password'

export const PASSWORD_RESET_PENDING = 'pending' // pragma: allowlist secret
export const PASSWORD_RESET_CONSUMED = 'consumed' // pragma: allowlist secret
export const PASSWORD_RESET_EXPIRED = 'expired' // pragma: allowlist secret
export const PASSWORD_RESET_CANCELLED = 'cancelled' // pragma: allowlist secret

export const PASSWORD_RESET_STATUS_VALUES = [
  PASSWORD_RESET_PENDING,
  PASSWORD_RESET_CONSUMED,
  PASSWORD_RESET_EXPIRED,
  PASSWORD_RESET_CANCELLED,
] as const

export type PasswordResetStatus = (typeof PASSWORD_RESET_STATUS_VALUES)[number]

export const passwordResetStatusValidator = v.union(
  v.literal(PASSWORD_RESET_PENDING),
  v.literal(PASSWORD_RESET_CONSUMED),
  v.literal(PASSWORD_RESET_EXPIRED),
  v.literal(PASSWORD_RESET_CANCELLED),
)

export const passwordResetTables = {
  passwordResetRequests: defineTable({
    email: v.string(),
    tokenHash: v.string(),
    status: passwordResetStatusValidator,
    requestedAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    lastSentAt: v.number(),
  })
    .index('by_email_status', ['email', 'status'])
    .index('by_token_hash', ['tokenHash'])
    .index('by_expires_at', ['expiresAt']),
}

export function resolvePasswordResetExpiry(
  now: number,
  ttlMs = PASSWORD_RESET_REQUEST_TTL_MS,
) {
  return now + Math.max(1, Math.floor(ttlMs))
}

export function buildPasswordResetLink(params: {
  siteUrl: string
  token: string
  path?: string
}) {
  const base = params.siteUrl.replace(/\/+$/, '')
  const path = (params.path ?? DEFAULT_PASSWORD_RESET_PATH).replace(/^\/?/, '/')
  const url = new URL(`${base}${path}`)
  url.searchParams.set('token', params.token)
  return url.toString()
}
