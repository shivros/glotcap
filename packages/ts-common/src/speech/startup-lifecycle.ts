import { createSessionLifecycleGate } from './session-lifecycle-gate'

type StartupLifecycleState = 'idle' | 'starting' | 'started'

export type StartupLifecyclePort = {
  beginStart: () => number
  completeStart: (token: number) => boolean
  cancel: () => number
  isCurrent: (token: number) => boolean
  isActive: () => boolean
}

export const createDefaultStartupLifecycle = (): StartupLifecyclePort => {
  const gate = createSessionLifecycleGate()
  let state: StartupLifecycleState = 'idle'

  const beginStart = () => {
    const token = gate.invalidate()
    state = 'starting'
    return token
  }

  const completeStart = (token: number) => {
    if (!gate.isCurrent(token)) {
      return false
    }
    state = 'started'
    return true
  }

  const cancel = () => {
    const token = gate.invalidate()
    state = 'idle'
    return token
  }

  return {
    beginStart,
    completeStart,
    cancel,
    isCurrent: gate.isCurrent,
    isActive: () => state === 'started',
  }
}

export const createStartupLifecycle = createDefaultStartupLifecycle
