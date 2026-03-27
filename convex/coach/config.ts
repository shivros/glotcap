export const DEFAULT_COACH_TEMPERATURE = 0.6
export const MAX_COACH_HISTORY_MESSAGES = 14

export const requireEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing ${key} environment variable`)
  }
  return value
}
