import type { AudioPermissionState } from '@/lib/audio/audio-device-port'
import type { MicPermission } from '@/lib/speaking-session-types'

export type AudioPermissionEvidence = {
  isSupported: boolean
  browserPermission: PermissionState | null
  sessionMicPermission?: MicPermission
  requestOutcome: 'none' | 'granted' | 'denied'
}

const SESSION_PERMISSION_TO_AUDIO_PERMISSION: Partial<
  Record<MicPermission, AudioPermissionState>
> = {
  granted: 'granted',
  denied: 'denied',
  unsupported: 'unsupported',
}

const BROWSER_PERMISSION_TO_AUDIO_PERMISSION: Record<
  PermissionState,
  AudioPermissionState
> = {
  granted: 'granted',
  denied: 'denied',
  prompt: 'unknown',
}

export const resolveAudioPermissionState = ({
  isSupported,
  browserPermission,
  sessionMicPermission,
  requestOutcome,
}: AudioPermissionEvidence): AudioPermissionState => {
  if (!isSupported) {
    return 'unsupported'
  }

  if (sessionMicPermission) {
    const sessionPermission =
      SESSION_PERMISSION_TO_AUDIO_PERMISSION[sessionMicPermission]
    if (sessionPermission) {
      return sessionPermission
    }
  }

  if (browserPermission) {
    if (browserPermission === 'prompt' && requestOutcome !== 'none') {
      return requestOutcome
    }
    return BROWSER_PERMISSION_TO_AUDIO_PERMISSION[browserPermission]
  }

  if (requestOutcome !== 'none') {
    return requestOutcome
  }

  return 'unknown'
}
