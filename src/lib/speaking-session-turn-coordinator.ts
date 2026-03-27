import { useCallback, useRef } from 'react'

const createTurnId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `turn_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

export type TurnCoordinator = {
  getTurnId: () => string
  isFinalized: () => boolean
  markActive: () => void
  markFinalized: () => void
  invalidateTurn: () => string
  advanceTurn: () => string
  reset: () => string
}

export const useTurnCoordinator = (): TurnCoordinator => {
  const turnIdRef = useRef<string>(createTurnId())
  const finalizedRef = useRef(false)

  const getTurnId = useCallback(() => turnIdRef.current, [])
  const isFinalized = useCallback(() => finalizedRef.current, [])
  const markActive = useCallback(() => {
    finalizedRef.current = false
  }, [])
  const markFinalized = useCallback(() => {
    finalizedRef.current = true
  }, [])

  const rotateTurn = useCallback(() => {
    const next = createTurnId()
    turnIdRef.current = next
    finalizedRef.current = false
    return next
  }, [])

  return {
    getTurnId,
    isFinalized,
    markActive,
    markFinalized,
    invalidateTurn: rotateTurn,
    advanceTurn: rotateTurn,
    reset: rotateTurn,
  }
}
