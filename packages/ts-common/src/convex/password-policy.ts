export const MIN_PASSWORD_LENGTH = 8

export function validatePasswordPolicy(password: string) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
  }
}
