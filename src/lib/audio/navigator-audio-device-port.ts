import type { AudioDevicePort } from '@/lib/audio/audio-device-port'

type NavigatorMediaDevices = MediaDevices & {
  enumerateDevices?: unknown
  getUserMedia?: unknown
  addEventListener?: unknown
  removeEventListener?: unknown
}

type NavigatorPermissions = Permissions & {
  query?: unknown
}

const getNavigatorMediaDevices = (): NavigatorMediaDevices | null => {
  if (typeof navigator === 'undefined') {
    return null
  }
  return navigator.mediaDevices as NavigatorMediaDevices
}

const getNavigatorPermissions = (): NavigatorPermissions | null => {
  if (typeof navigator === 'undefined') {
    return null
  }
  return navigator.permissions as NavigatorPermissions
}

export const navigatorAudioDevicePort: AudioDevicePort = {
  canEnumerateDevices: () => {
    const mediaDevices = getNavigatorMediaDevices()
    return !!mediaDevices && typeof mediaDevices.enumerateDevices === 'function'
  },
  canRequestUserMedia: () => {
    const mediaDevices = getNavigatorMediaDevices()
    return !!mediaDevices && typeof mediaDevices.getUserMedia === 'function'
  },
  enumerateDevices: async () => {
    const mediaDevices = getNavigatorMediaDevices()
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') {
      return []
    }
    return mediaDevices.enumerateDevices()
  },
  requestUserMedia: (constraints) => {
    const mediaDevices = getNavigatorMediaDevices()
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      throw new Error('Microphone access is not supported in this browser.')
    }
    return mediaDevices.getUserMedia(constraints)
  },
  queryMicrophonePermission: async () => {
    const permissions = getNavigatorPermissions()
    if (!permissions || typeof permissions.query !== 'function') {
      return null
    }
    try {
      const status = await permissions.query({
        name: 'microphone' as PermissionName,
      })
      return status.state
    } catch {
      return null
    }
  },
  subscribeToDeviceChanges: (onChange) => {
    const mediaDevices = getNavigatorMediaDevices()
    if (
      !mediaDevices ||
      typeof mediaDevices.addEventListener !== 'function' ||
      typeof mediaDevices.removeEventListener !== 'function'
    ) {
      return null
    }
    mediaDevices.addEventListener('devicechange', onChange)
    return () => {
      mediaDevices.removeEventListener('devicechange', onChange)
    }
  },
  subscribeToMicrophonePermissionChanges: async (onChange) => {
    const permissions = getNavigatorPermissions()
    if (!permissions || typeof permissions.query !== 'function') {
      return null
    }
    try {
      const status = await permissions.query({
        name: 'microphone' as PermissionName,
      })
      const handlePermissionChange = () => {
        onChange(status.state)
      }
      if (typeof status.addEventListener === 'function') {
        status.addEventListener('change', handlePermissionChange)
        return () => {
          status.removeEventListener('change', handlePermissionChange)
        }
      }
      return null
    } catch {
      return null
    }
  },
}
