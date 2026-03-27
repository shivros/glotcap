export type AudioPermissionState =
  | 'unknown'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'

export type AudioInputOption = {
  id: string
  label: string
  isMonitor: boolean
}

export type AudioDeviceEnumerationPort = {
  canEnumerateDevices: () => boolean
  enumerateDevices: () => Promise<Array<MediaDeviceInfo>>
  subscribeToDeviceChanges: (onChange: () => void) => (() => void) | null
}

export type AudioUserMediaPort = {
  canRequestUserMedia: () => boolean
  requestUserMedia: (
    constraints: MediaStreamConstraints,
  ) => Promise<MediaStream>
}

export type MicrophonePermissionPort = {
  queryMicrophonePermission: () => Promise<PermissionState | null>
  subscribeToMicrophonePermissionChanges: (
    onChange: (state: PermissionState) => void,
  ) => Promise<(() => void) | null>
}

export type AudioDevicePort = AudioDeviceEnumerationPort &
  AudioUserMediaPort &
  MicrophonePermissionPort
