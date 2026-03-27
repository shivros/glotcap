export type SessionLifecycleGate = {
  snapshot: () => number
  invalidate: () => number
  isCurrent: (token: number) => boolean
  runIfCurrent: <T>(token: number, run: () => T) => T | undefined
}

export const createSessionLifecycleGate = (
  initialToken = 0,
): SessionLifecycleGate => {
  let token = initialToken

  const snapshot = () => token

  const invalidate = () => {
    token += 1
    return token
  }

  const isCurrent = (candidate: number) => candidate === token

  const runIfCurrent = <T>(candidate: number, run: () => T): T | undefined => {
    if (!isCurrent(candidate)) {
      return undefined
    }
    return run()
  }

  return {
    snapshot,
    invalidate,
    isCurrent,
    runIfCurrent,
  }
}
