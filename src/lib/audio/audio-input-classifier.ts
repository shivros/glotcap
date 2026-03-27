import type { AudioInputOption } from '@/lib/audio/audio-device-port'

const MONITOR_DEVICE_PATTERN = /(monitor|loopback|stereo mix|what u hear)/i

export const toAudioInputCatalog = (
  devices: Array<MediaDeviceInfo>,
): { inputs: Array<AudioInputOption> } => {
  const inputs = devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => {
      const visibleLabel = device.label.trim()
      const label = visibleLabel || `Audio input ${index + 1}`
      return {
        id: device.deviceId,
        label,
        isMonitor: MONITOR_DEVICE_PATTERN.test(label),
      }
    })

  return {
    inputs,
  }
}
