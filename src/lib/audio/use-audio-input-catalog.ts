import { useCallback, useMemo } from 'react'
import type {
  AudioDeviceEnumerationPort,
  AudioUserMediaPort,
  MicrophonePermissionPort,
} from '@/lib/audio/audio-device-port'
import type { MicPermission } from '@/lib/speaking-session-types'
import { useAudioDeviceList } from '@/lib/audio/use-audio-device-list'
import { useAudioPermissionState } from '@/lib/audio/use-audio-permission-state'

type UseAudioInputCatalogArgs = {
  port: AudioInputCatalogPort
  sessionMicPermission?: MicPermission
}

type AudioInputCatalogPort = AudioDeviceEnumerationPort &
  AudioUserMediaPort &
  Partial<MicrophonePermissionPort>

export const useAudioInputCatalog = ({
  port,
  sessionMicPermission,
}: UseAudioInputCatalogArgs) => {
  const isSupported = useMemo(
    () => port.canEnumerateDevices() && port.canRequestUserMedia(),
    [port],
  )

  const {
    inputs,
    isRefreshing,
    errorMessage: deviceErrorMessage,
    refresh: refreshDeviceList,
    clearError: clearDeviceError,
  } = useAudioDeviceList({
    isSupported,
    port,
  })

  const onPermissionGranted = useCallback(async () => {
    await refreshDeviceList()
  }, [refreshDeviceList])

  const {
    permissionState,
    errorMessage: permissionErrorMessage,
    requestPermission: requestPermissionState,
    clearError: clearPermissionError,
  } = useAudioPermissionState({
    isSupported,
    sessionMicPermission,
    port,
    onPermissionGranted,
  })

  const refresh = useCallback(async () => {
    clearPermissionError()
    await refreshDeviceList()
  }, [clearPermissionError, refreshDeviceList])

  const requestPermission = useCallback(async () => {
    clearDeviceError()
    await requestPermissionState()
  }, [clearDeviceError, requestPermissionState])

  return {
    isSupported,
    permissionState,
    inputs,
    isRefreshing,
    errorMessage: permissionErrorMessage ?? deviceErrorMessage,
    refresh,
    requestPermission,
  }
}
