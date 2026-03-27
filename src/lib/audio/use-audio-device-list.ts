import { useCallback, useEffect, useState } from 'react'
import type {
  AudioDeviceEnumerationPort,
  AudioInputOption,
} from '@/lib/audio/audio-device-port'
import { AUDIO_CATALOG_COPY } from '@/lib/audio/audio-catalog-copy'
import { toAudioInputCatalog } from '@/lib/audio/audio-input-classifier'

type UseAudioDeviceListArgs = {
  isSupported: boolean
  port: AudioDeviceEnumerationPort
}

type UseAudioDeviceListState = {
  inputs: Array<AudioInputOption>
  isRefreshing: boolean
  errorMessage: string | null
  refresh: () => Promise<void>
  clearError: () => void
}

export const useAudioDeviceList = ({
  isSupported,
  port,
}: UseAudioDeviceListArgs): UseAudioDeviceListState => {
  const [inputs, setInputs] = useState<Array<AudioInputOption>>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!isSupported) {
      setInputs([])
      return
    }

    setIsRefreshing(true)
    setErrorMessage(null)
    try {
      const devices = await port.enumerateDevices()
      const catalog = toAudioInputCatalog(devices)
      setInputs(catalog.inputs)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : AUDIO_CATALOG_COPY.listInputsError,
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [isSupported, port])

  useEffect(() => {
    if (!isSupported) {
      return
    }

    void refresh()

    const unsubscribe = port.subscribeToDeviceChanges(() => {
      void refresh()
    })

    return () => {
      unsubscribe?.()
    }
  }, [isSupported, port, refresh])

  return {
    inputs,
    isRefreshing,
    errorMessage,
    refresh,
    clearError,
  }
}
