import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireTeacherAudioStream } from '@/lib/audio/teacher-audio-source'

const originalNavigator = globalThis.navigator

const setNavigator = (value: unknown) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

const createStream = ({
  hasAudioTrack = true,
  stopTrack,
}: {
  hasAudioTrack?: boolean
  stopTrack?: () => void
}) => {
  const stop = stopTrack ?? vi.fn()
  const track = { stop }
  return {
    getAudioTracks: () => (hasAudioTrack ? [track] : []),
    getTracks: () => [track],
  } as unknown as MediaStream
}

describe('acquireTeacherAudioStream', () => {
  afterEach(() => {
    setNavigator(originalNavigator)
  })

  it('acquires display media stream when method is display', async () => {
    const displayStream = createStream({})
    const getDisplayMedia = vi.fn(() => Promise.resolve(displayStream))
    setNavigator({
      mediaDevices: {
        getDisplayMedia,
      },
    })

    const stream = await acquireTeacherAudioStream({
      method: 'display',
    })

    expect(stream).toBe(displayStream)
    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: true,
    })
  })

  it('fails when display stream does not include an audio track', async () => {
    const stopTrack = vi.fn()
    const getDisplayMedia = vi.fn(() =>
      Promise.resolve(
        createStream({
          hasAudioTrack: false,
          stopTrack,
        }),
      ),
    )
    setNavigator({
      mediaDevices: {
        getDisplayMedia,
      },
    })

    await expect(
      acquireTeacherAudioStream({
        method: 'display',
      }),
    ).rejects.toThrow('does not include audio')
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })

  it('acquires user media stream when method is device', async () => {
    const userMediaStream = createStream({})
    const getUserMedia = vi.fn(() => Promise.resolve(userMediaStream))
    setNavigator({
      mediaDevices: {
        getUserMedia,
      },
    })

    const stream = await acquireTeacherAudioStream({
      method: 'device',
      deviceId: 'device-1',
    })

    expect(stream).toBe(userMediaStream)
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'device-1' },
      },
    })
  })
})
