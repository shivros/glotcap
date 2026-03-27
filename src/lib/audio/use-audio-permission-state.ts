import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AudioPermissionState,
  AudioUserMediaPort,
  MicrophonePermissionPort,
} from '@/lib/audio/audio-device-port'
import type { MicPermission } from '@/lib/speaking-session-types'
import { AUDIO_CATALOG_COPY } from '@/lib/audio/audio-catalog-copy'
import { resolveAudioPermissionState } from '@/lib/audio/audio-permission-resolver'

type PermissionRequestOutcome = 'none' | 'granted' | 'denied'

type AudioPermissionPort = AudioUserMediaPort &
  Partial<MicrophonePermissionPort>

type UseAudioPermissionStateArgs = {
  isSupported: boolean
  sessionMicPermission?: MicPermission
  port: AudioPermissionPort
  onPermissionGranted?: () => void | Promise<void>
}

type UseAudioPermissionStateResult = {
  permissionState: AudioPermissionState
  errorMessage: string | null
  requestPermission: () => Promise<void>
  clearError: () => void
}

export const useAudioPermissionState = ({
  isSupported,
  sessionMicPermission,
  port,
  onPermissionGranted,
}: UseAudioPermissionStateArgs): UseAudioPermissionStateResult => {
  const [browserPermission, setBrowserPermission] =
    useState<PermissionState | null>(null)
  const [requestOutcome, setRequestOutcome] =
    useState<PermissionRequestOutcome>('none')
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  const permissionState = useMemo(() => {
    if (isRequestingPermission) {
      return 'requesting'
    }

    return resolveAudioPermissionState({
      isSupported,
      browserPermission,
      sessionMicPermission,
      requestOutcome,
    })
  }, [
    browserPermission,
    isRequestingPermission,
    isSupported,
    requestOutcome,
    sessionMicPermission,
  ])

  const requestPermission = useCallback(async () => {
    if (!isSupported || !port.canRequestUserMedia()) {
      return
    }

    if (permissionState === 'granted') {
      await onPermissionGranted?.()
      return
    }

    setIsRequestingPermission(true)
    setErrorMessage(null)
    try {
      const stream = await port.requestUserMedia({ audio: true })
      for (const track of stream.getTracks()) {
        track.stop()
      }
      setRequestOutcome('granted')
      await onPermissionGranted?.()
    } catch (error) {
      setRequestOutcome('denied')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : AUDIO_CATALOG_COPY.deniedPermissionError,
      )
    } finally {
      setIsRequestingPermission(false)
    }
  }, [isSupported, onPermissionGranted, permissionState, port])

  useEffect(() => {
    if (!isSupported) {
      return
    }

    const mountedRef = { current: true }
    let unsubscribePermissionChanges: (() => void) | null = null
    const queryMicrophonePermission =
      port.queryMicrophonePermission ?? (() => Promise.resolve(null))
    const subscribeToMicrophonePermissionChanges =
      port.subscribeToMicrophonePermissionChanges ??
      (() => Promise.resolve(null))

    void (async () => {
      const nextPermission = await queryMicrophonePermission()
      if (mountedRef.current) {
        setBrowserPermission(nextPermission)
        if (nextPermission === 'granted') {
          setRequestOutcome('granted')
          void onPermissionGranted?.()
        }
      }

      const unsubscribe = await subscribeToMicrophonePermissionChanges(
        (nextState) => {
          if (!mountedRef.current) {
            return
          }

          setBrowserPermission(nextState)
          if (nextState === 'granted') {
            setRequestOutcome('granted')
            void onPermissionGranted?.()
            return
          }
          if (nextState === 'denied') {
            setRequestOutcome('denied')
            return
          }
          setRequestOutcome('none')
        },
      )
      if (!mountedRef.current) {
        unsubscribe?.()
        return
      }
      unsubscribePermissionChanges = unsubscribe
    })()

    return () => {
      mountedRef.current = false
      unsubscribePermissionChanges?.()
    }
  }, [isSupported, onPermissionGranted, port])

  useEffect(() => {
    if (sessionMicPermission === 'granted') {
      setRequestOutcome('granted')
      void onPermissionGranted?.()
      return
    }
    if (sessionMicPermission === 'denied') {
      setRequestOutcome('denied')
      return
    }
    if (sessionMicPermission === 'unknown') {
      setRequestOutcome('none')
    }
  }, [onPermissionGranted, sessionMicPermission])

  return {
    permissionState,
    errorMessage,
    requestPermission,
    clearError,
  }
}
