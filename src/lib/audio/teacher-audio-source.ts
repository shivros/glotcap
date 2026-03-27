import type { TeacherInputSourceMethod } from '@/lib/speaking-session-types'

type MediaDevicesWithDisplay = MediaDevices & {
  getDisplayMedia?: unknown
  getUserMedia?: unknown
}

const getMediaDevices = (): MediaDevicesWithDisplay | null => {
  if (typeof navigator === 'undefined') {
    return null
  }
  return navigator.mediaDevices as MediaDevicesWithDisplay
}

const assertHasAudioTrack = (stream: MediaStream) => {
  if (stream.getAudioTracks().length > 0) {
    return
  }
  stream.getTracks().forEach((track) => track.stop())
  throw new Error('The selected share source does not include audio.')
}

type AcquireTeacherAudioStreamArgs = {
  method: TeacherInputSourceMethod
  deviceId?: string
}

export const acquireTeacherAudioStream = async ({
  method,
  deviceId,
}: AcquireTeacherAudioStreamArgs): Promise<MediaStream> => {
  const mediaDevices = getMediaDevices()
  if (!mediaDevices) {
    throw new Error('Audio capture is not supported in this browser.')
  }

  if (method === 'display') {
    if (typeof mediaDevices.getDisplayMedia !== 'function') {
      throw new Error(
        'System audio capture via screen share is not supported in this browser.',
      )
    }
    const stream = await mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    assertHasAudioTrack(stream)
    return stream
  }

  if (!deviceId) {
    throw new Error('Select a teacher audio source before starting.')
  }
  if (typeof mediaDevices.getUserMedia !== 'function') {
    throw new Error('Audio capture is not supported in this browser.')
  }
  return mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
    },
  })
}
