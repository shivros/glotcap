import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AudioDevicePort } from '@/lib/audio/audio-device-port'
import type { MicPermission } from '@/lib/speaking-session-types'
import { useAudioInputCatalog } from '@/lib/audio/use-audio-input-catalog'

const createDevice = (args: {
  deviceId: string
  label: string
  kind?: MediaDeviceKind
}): MediaDeviceInfo =>
  ({
    kind: args.kind ?? 'audioinput',
    deviceId: args.deviceId,
    label: args.label,
    groupId: 'group',
    toJSON: () => ({}),
  }) as MediaDeviceInfo

const createAudioStream = (stopTrack: () => void): MediaStream =>
  ({
    getTracks: () => [{ stop: stopTrack }],
  }) as unknown as MediaStream

const createPort = (
  overrides: Partial<AudioDevicePort> = {},
): AudioDevicePort => ({
  canEnumerateDevices: () => true,
  canRequestUserMedia: () => true,
  enumerateDevices: () => Promise.resolve([]),
  requestUserMedia: () => Promise.resolve(createAudioStream(() => {})),
  queryMicrophonePermission: () => Promise.resolve(null),
  subscribeToDeviceChanges: () => null,
  subscribeToMicrophonePermissionChanges: () => Promise.resolve(null),
  ...overrides,
})

describe('useAudioInputCatalog', () => {
  it('reports unsupported when media APIs are unavailable', () => {
    const port = createPort({
      canEnumerateDevices: () => false,
      canRequestUserMedia: () => false,
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))
    expect(result.current.isSupported).toBe(false)
    expect(result.current.permissionState).toBe('unsupported')
    expect(result.current.inputs).toEqual([])
  })

  it('enumerates audio inputs with fallback labels and monitor detection', async () => {
    const port = createPort({
      enumerateDevices: () =>
        Promise.resolve([
          createDevice({ deviceId: 'mic-1', label: '' }),
          createDevice({
            deviceId: 'mic-2',
            label: 'Monitor of USB Interface',
          }),
        ]),
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await waitFor(() => expect(result.current.inputs.length).toBe(2))
    expect(result.current.inputs[0]).toMatchObject({
      id: 'mic-1',
      label: 'Audio input 1',
      isMonitor: false,
    })
    expect(result.current.inputs[1]).toMatchObject({
      id: 'mic-2',
      label: 'Monitor of USB Interface',
      isMonitor: true,
    })
    expect(result.current.permissionState).toBe('unknown')
  })

  it('keeps permission unknown in Firefox-like environments until explicitly requested', async () => {
    const port = createPort({
      enumerateDevices: () =>
        Promise.resolve([
          createDevice({ deviceId: 'mic-1', label: 'USB Microphone' }),
        ]),
      queryMicrophonePermission: () => Promise.resolve(null),
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await waitFor(() => expect(result.current.inputs.length).toBe(1))
    expect(result.current.permissionState).toBe('unknown')
  })

  it('requests permission and refreshes device labels', async () => {
    const stopTrack = vi.fn()
    const enumerateDevices = vi
      .fn<() => Promise<Array<MediaDeviceInfo>>>()
      .mockResolvedValueOnce([createDevice({ deviceId: 'mic-1', label: '' })])
      .mockResolvedValueOnce([
        createDevice({ deviceId: 'mic-1', label: 'USB Microphone' }),
      ])
    const requestUserMedia = vi.fn(() =>
      Promise.resolve(createAudioStream(stopTrack)),
    )
    const port = createPort({
      enumerateDevices,
      requestUserMedia,
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await waitFor(() =>
      expect(result.current.inputs[0]?.label).toBe('Audio input 1'),
    )

    await act(async () => {
      await result.current.requestPermission()
    })

    await waitFor(() =>
      expect(result.current.inputs[0]?.label).toBe('USB Microphone'),
    )
    expect(requestUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(result.current.permissionState).toBe('granted')
  })

  it('updates when session microphone permission changes', async () => {
    const enumerateDevices = vi.fn(() => Promise.resolve([]))
    const port = createPort({ enumerateDevices })
    const { result, rerender } = renderHook(
      ({ sessionMicPermission }) =>
        useAudioInputCatalog({
          port,
          sessionMicPermission,
        }),
      {
        initialProps: { sessionMicPermission: 'unknown' as MicPermission },
      },
    )

    await waitFor(() => expect(result.current.permissionState).toBe('unknown'))

    rerender({ sessionMicPermission: 'denied' })
    await waitFor(() => expect(result.current.permissionState).toBe('denied'))

    rerender({ sessionMicPermission: 'granted' })
    await waitFor(() => expect(result.current.permissionState).toBe('granted'))
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalled())
  })

  it('refreshes devices on devicechange events', async () => {
    let onDeviceChange: (() => void) | null = null
    const enumerateDevices = vi
      .fn<() => Promise<Array<MediaDeviceInfo>>>()
      .mockResolvedValue([createDevice({ deviceId: 'mic-1', label: 'Mic' })])
    const port = createPort({
      enumerateDevices,
      subscribeToDeviceChanges: (onChange) => {
        onDeviceChange = onChange
        return () => {
          onDeviceChange = null
        }
      },
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await waitFor(() => expect(result.current.inputs.length).toBe(1))
    expect(enumerateDevices).toHaveBeenCalledTimes(1)

    act(() => {
      onDeviceChange?.()
    })

    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(2))
  })

  it('clears permission errors when manually refreshing devices', async () => {
    const enumerateDevices = vi.fn(() => Promise.resolve([]))
    const port = createPort({
      enumerateDevices,
      requestUserMedia: () => Promise.reject(new Error('permission denied')),
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await act(async () => {
      await result.current.requestPermission()
    })
    expect(result.current.errorMessage).toBe('permission denied')

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.errorMessage).toBe(null))
    expect(enumerateDevices).toHaveBeenCalled()
  })

  it('clears stale device-list errors when requesting permission', async () => {
    const stopTrack = vi.fn()
    const enumerateDevices = vi
      .fn<() => Promise<Array<MediaDeviceInfo>>>()
      .mockRejectedValueOnce(new Error('device list failed'))
      .mockResolvedValueOnce([])
    const port = createPort({
      enumerateDevices,
      requestUserMedia: () => Promise.resolve(createAudioStream(stopTrack)),
    })
    const { result } = renderHook(() => useAudioInputCatalog({ port }))

    await waitFor(() =>
      expect(result.current.errorMessage).toBe('device list failed'),
    )

    await act(async () => {
      await result.current.requestPermission()
    })

    await waitFor(() => expect(result.current.errorMessage).toBe(null))
    expect(result.current.permissionState).toBe('granted')
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })
})
