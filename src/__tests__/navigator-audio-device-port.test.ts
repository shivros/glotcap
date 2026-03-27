import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigatorAudioDevicePort } from '@/lib/audio/navigator-audio-device-port'

const originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
)
const originalPermissionsDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'permissions',
)

const setNavigatorProperty = (
  key: 'mediaDevices' | 'permissions',
  value: unknown,
) => {
  Object.defineProperty(navigator, key, {
    value,
    configurable: true,
    writable: true,
  })
}

const restoreNavigatorProperty = (
  key: 'mediaDevices' | 'permissions',
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(navigator, key, descriptor)
    return
  }
  Reflect.deleteProperty(navigator, key)
}

afterEach(() => {
  restoreNavigatorProperty('mediaDevices', originalMediaDevicesDescriptor)
  restoreNavigatorProperty('permissions', originalPermissionsDescriptor)
  vi.restoreAllMocks()
})

describe('navigatorAudioDevicePort', () => {
  it('detects media API support and enumerates devices', async () => {
    const devices = [{ kind: 'audioinput' }] as Array<MediaDeviceInfo>
    const enumerateDevices = vi.fn(() => Promise.resolve(devices))
    const getUserMedia = vi.fn(() => Promise.resolve({} as MediaStream))
    setNavigatorProperty('mediaDevices', {
      enumerateDevices,
      getUserMedia,
    })

    expect(navigatorAudioDevicePort.canEnumerateDevices()).toBe(true)
    expect(navigatorAudioDevicePort.canRequestUserMedia()).toBe(true)
    await expect(navigatorAudioDevicePort.enumerateDevices()).resolves.toBe(
      devices,
    )
    await navigatorAudioDevicePort.requestUserMedia({ audio: true })
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  })

  it('handles unsupported media APIs', async () => {
    setNavigatorProperty('mediaDevices', {})

    expect(navigatorAudioDevicePort.canEnumerateDevices()).toBe(false)
    expect(navigatorAudioDevicePort.canRequestUserMedia()).toBe(false)
    await expect(navigatorAudioDevicePort.enumerateDevices()).resolves.toEqual(
      [],
    )
    expect(() =>
      navigatorAudioDevicePort.requestUserMedia({ audio: true }),
    ).toThrow('Microphone access is not supported in this browser.')
  })

  it('queries permission state and handles missing/throwing permissions API', async () => {
    const query = vi.fn(() => Promise.resolve({ state: 'granted' }))
    setNavigatorProperty('permissions', { query })
    await expect(
      navigatorAudioDevicePort.queryMicrophonePermission(),
    ).resolves.toBe('granted')

    setNavigatorProperty('permissions', {})
    await expect(
      navigatorAudioDevicePort.queryMicrophonePermission(),
    ).resolves.toBe(null)

    setNavigatorProperty('permissions', {
      query: () => Promise.reject(new Error('not supported')),
    })
    await expect(
      navigatorAudioDevicePort.queryMicrophonePermission(),
    ).resolves.toBe(null)
  })

  it('subscribes/unsubscribes devicechange listeners when supported', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const onChange = vi.fn()
    setNavigatorProperty('mediaDevices', {
      addEventListener,
      removeEventListener,
    })

    const unsubscribe =
      navigatorAudioDevicePort.subscribeToDeviceChanges(onChange)
    expect(addEventListener).toHaveBeenCalledWith('devicechange', onChange)
    expect(unsubscribe).toBeTypeOf('function')

    unsubscribe?.()
    expect(removeEventListener).toHaveBeenCalledWith('devicechange', onChange)
  })

  it('returns null for devicechange subscription when unsupported', () => {
    setNavigatorProperty('mediaDevices', {})
    expect(
      navigatorAudioDevicePort.subscribeToDeviceChanges(() => {}),
    ).toBeNull()
  })

  it('subscribes and reacts to microphone permission changes', async () => {
    const status = {
      state: 'prompt' as PermissionState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    setNavigatorProperty('permissions', {
      query: vi.fn(() => Promise.resolve(status)),
    })
    const onChange = vi.fn()

    const unsubscribe =
      await navigatorAudioDevicePort.subscribeToMicrophonePermissionChanges(
        onChange,
      )
    expect(status.addEventListener).toHaveBeenCalled()

    status.state = 'granted'
    const permissionListener = status.addEventListener.mock.calls[0]?.[1] as
      | (() => void)
      | undefined
    permissionListener?.()
    expect(onChange).toHaveBeenCalledWith('granted')

    unsubscribe?.()
    expect(status.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })

  it('returns null for permission subscription when unsupported', async () => {
    setNavigatorProperty('permissions', {})
    await expect(
      navigatorAudioDevicePort.subscribeToMicrophonePermissionChanges(() => {}),
    ).resolves.toBeNull()
  })

  it('returns null for permission subscription when query fails', async () => {
    setNavigatorProperty('permissions', {
      query: () => Promise.reject(new Error('boom')),
    })
    await expect(
      navigatorAudioDevicePort.subscribeToMicrophonePermissionChanges(() => {}),
    ).resolves.toBeNull()
  })
})
