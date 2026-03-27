export const INVITE_CODE_LENGTH = 8
export const INVITE_CODE_REGEX = /^[A-Z0-9]{8}$/

export function normalizeInviteCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, INVITE_CODE_LENGTH)
}

export function isInviteCodeFormatValid(code: string) {
  return INVITE_CODE_REGEX.test(code)
}
