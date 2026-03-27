import { defineTable } from 'convex/server'
import { ConvexError, v } from 'convex/values'

export const EMAIL_CHANGE_REQUEST_TTL_MS = 24 * 60 * 60 * 1000
export const EMAIL_CHANGE_RESEND_COOLDOWN_MS = 30 * 1000

export const EMAIL_CHANGE_PENDING = 'pending'
export const EMAIL_CHANGE_CONSUMED = 'consumed'
export const EMAIL_CHANGE_CANCELLED = 'cancelled'
export const EMAIL_CHANGE_EXPIRED = 'expired'

export const EMAIL_CHANGE_STATUS_VALUES = [
  EMAIL_CHANGE_PENDING,
  EMAIL_CHANGE_CONSUMED,
  EMAIL_CHANGE_CANCELLED,
  EMAIL_CHANGE_EXPIRED,
] as const

export type EmailChangeStatus = (typeof EMAIL_CHANGE_STATUS_VALUES)[number]

export const emailChangeStatusValidator = v.union(
  v.literal(EMAIL_CHANGE_PENDING),
  v.literal(EMAIL_CHANGE_CONSUMED),
  v.literal(EMAIL_CHANGE_CANCELLED),
  v.literal(EMAIL_CHANGE_EXPIRED),
)

export const emailChangeTables = {
  emailChangeRequests: defineTable({
    userId: v.id('users'),
    currentEmail: v.string(),
    newEmail: v.string(),
    tokenHash: v.string(),
    status: emailChangeStatusValidator,
    requestedAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    verifiedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    resendCount: v.number(),
    lastSentAt: v.number(),
  })
    .index('by_user_status', ['userId', 'status'])
    .index('by_new_email_status', ['newEmail', 'status'])
    .index('by_token_hash', ['tokenHash'])
    .index('by_expires_at', ['expiresAt']),
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAuthEmail(input: string): string {
  return input.trim().toLowerCase()
}

export function isAuthEmailFormatValid(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function requireValidAuthEmail(input: string): string {
  const email = normalizeAuthEmail(input)
  if (!email || !isAuthEmailFormatValid(email)) {
    throw new ConvexError({
      code: 'INVALID_EMAIL',
      message: 'Please enter a valid email address.',
    })
  }
  return email
}

export function resolveEmailChangeExpiry(
  now: number,
  ttlMs = EMAIL_CHANGE_REQUEST_TTL_MS,
) {
  return now + Math.max(1, Math.floor(ttlMs))
}

export function generateEmailChangeToken(bytes = 24): string {
  const size = Math.max(16, Math.floor(bytes))
  const buffer = new Uint8Array(size)
  crypto.getRandomValues(buffer)
  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, size * 2)
}

export async function hashEmailChangeToken(token: string): Promise<string> {
  const normalized = token.trim()
  const input = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
}

export type EmailChangeStatusView = {
  currentEmail: string | null
  pendingChange: {
    newEmail: string
    expiresAt: number
    requestedAt: number
    resendCount: number
    isExpired: boolean
  } | null
}

export function buildEmailChangeStatusView(params: {
  currentEmail: string | null
  pendingRequest: {
    newEmail: string
    expiresAt: number
    requestedAt: number
    resendCount: number
  } | null
  now: number
}): EmailChangeStatusView {
  if (!params.pendingRequest) {
    return { currentEmail: params.currentEmail, pendingChange: null }
  }
  return {
    currentEmail: params.currentEmail,
    pendingChange: {
      newEmail: params.pendingRequest.newEmail,
      expiresAt: params.pendingRequest.expiresAt,
      requestedAt: params.pendingRequest.requestedAt,
      resendCount: params.pendingRequest.resendCount,
      isExpired: params.pendingRequest.expiresAt <= params.now,
    },
  }
}

export function buildEmailChangeVerificationLink(params: {
  siteUrl: string
  token: string
  path?: string
}) {
  const base = params.siteUrl.replace(/\/+$/, '')
  const path = (params.path ?? '/app/account/email-change/verify').replace(
    /^\/?/,
    '/',
  )
  const url = new URL(`${base}${path}`)
  url.searchParams.set('token', params.token)
  return url.toString()
}
