import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AudioDevicePort } from '@/lib/audio/audio-device-port'
import type { MicPermission } from '@/lib/speaking-session-types'
import { useAudioPermissionState } from '@/lib/audio/use-audio-permission-state'

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

describe('useAudioPermissionState', () => {
  it('returns unsupported when media APIs are unavailable', () => {
    const { result } = renderHook(() =>
      useAudioPermissionState({
        isSupported: false,
        port: createPort(),
      }),
    )

    expect(result.current.permissionState).toBe('unsupported')
  })

  it('keeps permission unknown when no explicit permission signal is available', async () => {
    const { result } = renderHook(() =>
      useAudioPermissionState({
        isSupported: true,
        port: createPort({
          queryMicrophonePermission: () => Promise.resolve(null),
        }),
      }),
    )

    await waitFor(() => expect(result.current.permissionState).toBe('unknown'))
  })

  it('invokes onPermissionGranted when browser permission is already granted', async () => {
    const onPermissionGranted = vi.fn()
    const { result } = renderHook(() =>
      useAudioPermissionState({
        isSupported: true,
        port: createPort({
          queryMicrophonePermission: () => Promise.resolve('granted'),
        }),
        onPermissionGranted,
      }),
    )

    await waitFor(() => expect(result.current.permissionState).toBe('granted'))
    expect(onPermissionGranted).toHaveBeenCalled()
  })

  it('requests permission and reports granted', async () => {
    const stopTrack = vi.fn()
    const onPermissionGranted = vi.fn()
    const requestUserMedia = vi.fn(() =>
      Promise.resolve(createAudioStream(stopTrack)),
    )
    const { result } = renderHook(() =>
      useAudioPermissionState({
        isSupported: true,
        port: createPort({
          queryMicrophonePermission: () => Promise.resolve('prompt'),
          requestUserMedia,
        }),
        onPermissionGranted,
      }),
    )

    await waitFor(() => expect(result.current.permissionState).toBe('unknown'))

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(requestUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(onPermissionGranted).toHaveBeenCalled()
    expect(result.current.permissionState).toBe('granted')
  })

  it('requests permission and reports denied on failure', async () => {
    const { result } = renderHook(() =>
      useAudioPermissionState({
        isSupported: true,
        port: createPort({
          requestUserMedia: () =>
            Promise.reject(new Error('permission denied')),
        }),
      }),
    )

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.permissionState).toBe('denied')
    expect(result.current.errorMessage).toBe('permission denied')
  })

  it('applies session microphone permission overrides', async () => {
    const { result, rerender } = renderHook(
      ({ sessionMicPermission }) =>
        useAudioPermissionState({
          isSupported: true,
          sessionMicPermission,
          port: createPort(),
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
  })

  it('reacts to microphone permission change events and unsubscribes on unmount', async () => {
    let permissionChangeHandler: ((state: PermissionState) => void) | null =
      null
    const unsubscribe = vi.fn()
    const onPermissionGranted = vi.fn()
    const { result, unmount } = renderHook(() =>
      useAudioPermissionState({
        isSupported: true,
        port: createPort({
          queryMicrophonePermission: () => Promise.resolve('prompt'),
          subscribeToMicrophonePermissionChanges: (onChange) => {
            permissionChangeHandler = onChange
            return Promise.resolve(unsubscribe)
          },
        }),
        onPermissionGranted,
      }),
    )

    await waitFor(() => expect(result.current.permissionState).toBe('unknown'))

    act(() => {
      permissionChangeHandler?.('denied')
    })
    await waitFor(() => expect(result.current.permissionState).toBe('denied'))

    act(() => {
      permissionChangeHandler?.('prompt')
    })
    await waitFor(() => expect(result.current.permissionState).toBe('unknown'))

    act(() => {
      permissionChangeHandler?.('granted')
    })
    await waitFor(() => expect(result.current.permissionState).toBe('granted'))
    await waitFor(() => expect(onPermissionGranted).toHaveBeenCalled())

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
