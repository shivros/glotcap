import { useCallback, useEffect, useState } from 'react'
import type {
  AudioSupportStatus,
  MicPermission,
} from './speaking-session-types'

type AudioSupportState = {
  supportStatus: AudioSupportStatus
  micPermission: MicPermission
  isSupported: boolean
  detectAudioSupport: () => boolean
  setMicPermission: (value: MicPermission) => void
  setSupportStatus: (value: AudioSupportStatus) => void
}

export const useAudioSupport = (): AudioSupportState => {
  const [supportStatus, setSupportStatus] =
    useState<AudioSupportStatus>('unknown')
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')

  const detectAudioSupport = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false
    }

    type NavigatorWithMediaDevices = Omit<Navigator, 'mediaDevices'> & {
      mediaDevices?: MediaDevices
    }
    const navigatorWithMedia = navigator as NavigatorWithMediaDevices
    const hasGetUserMedia =
      typeof navigatorWithMedia.mediaDevices?.getUserMedia === 'function'
    const hasWebSocket = typeof WebSocket !== 'undefined'

    return Boolean(hasGetUserMedia && hasWebSocket)
  }, [])

  useEffect(() => {
    const supported = detectAudioSupport()
    setSupportStatus(supported ? 'supported' : 'unsupported')
    if (!supported) {
      setMicPermission('unsupported')
    }
  }, [detectAudioSupport])

  return {
    supportStatus,
    micPermission,
    isSupported: supportStatus !== 'unsupported',
    detectAudioSupport,
    setMicPermission,
    setSupportStatus,
  }
}
