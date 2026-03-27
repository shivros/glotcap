import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AudioDeviceEnumerationPort } from '@/lib/audio/audio-device-port'
import { useAudioDeviceList } from '@/lib/audio/use-audio-device-list'

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

const createPort = (
  overrides: Partial<AudioDeviceEnumerationPort> = {},
): AudioDeviceEnumerationPort => ({
  canEnumerateDevices: () => true,
  enumerateDevices: () => Promise.resolve([]),
  subscribeToDeviceChanges: () => null,
  ...overrides,
})

describe('useAudioDeviceList', () => {
  it('does not enumerate when unsupported', () => {
    const enumerateDevices = vi.fn(() => Promise.resolve([]))
    const { result } = renderHook(() =>
      useAudioDeviceList({
        isSupported: false,
        port: createPort({ enumerateDevices }),
      }),
    )

    expect(result.current.inputs).toEqual([])
    expect(enumerateDevices).not.toHaveBeenCalled()
  })

  it('clears previously discovered inputs when refresh is called while unsupported', async () => {
    const supportedPort = createPort({
      enumerateDevices: () =>
        Promise.resolve([createDevice({ deviceId: 'mic-1', label: 'Mic' })]),
    })
    const unsupportedPort = createPort({
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    })
    const { result, rerender } = renderHook(
      ({ isSupported, port }) =>
        useAudioDeviceList({
          isSupported,
          port,
        }),
      {
        initialProps: { isSupported: true, port: supportedPort },
      },
    )

    await waitFor(() => expect(result.current.inputs.length).toBe(1))

    rerender({ isSupported: false, port: unsupportedPort })
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.inputs).toEqual([])
  })

  it('enumerates devices and refreshes on devicechange', async () => {
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
    const { result } = renderHook(() =>
      useAudioDeviceList({
        isSupported: true,
        port,
      }),
    )

    await waitFor(() => expect(result.current.inputs.length).toBe(1))
    expect(enumerateDevices).toHaveBeenCalledTimes(1)

    act(() => {
      onDeviceChange?.()
    })

    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(2))
  })

  it('exposes enumeration errors and clears them on refresh', async () => {
    const healthyEnumerateDevices = vi.fn(() => Promise.resolve([]))
    const failingPort = createPort({
      enumerateDevices: () =>
        Promise.reject(new Error('failed to list devices')),
    })
    const healthyPort = createPort({
      enumerateDevices: healthyEnumerateDevices,
    })
    const { result, rerender } = renderHook(
      ({ port }) =>
        useAudioDeviceList({
          isSupported: true,
          port,
        }),
      {
        initialProps: { port: failingPort },
      },
    )

    await waitFor(() =>
      expect(result.current.errorMessage).toBe('failed to list devices'),
    )

    rerender({ port: healthyPort })

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => expect(result.current.errorMessage).toBe(null))
    expect(healthyEnumerateDevices).toHaveBeenCalled()
  })
})
