export const WAITLIST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeWaitlistEmail(input: string) {
  return input.trim().toLowerCase()
}

export function isWaitlistEmailValid(input: string) {
  return WAITLIST_EMAIL_REGEX.test(normalizeWaitlistEmail(input))
}
