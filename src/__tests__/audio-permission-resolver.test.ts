import { describe, expect, it } from 'vitest'
import { resolveAudioPermissionState } from '@/lib/audio/audio-permission-resolver'

describe('resolveAudioPermissionState', () => {
  it('returns unsupported when media APIs are unavailable', () => {
    const state = resolveAudioPermissionState({
      isSupported: false,
      browserPermission: null,
      requestOutcome: 'none',
    })

    expect(state).toBe('unsupported')
  })

  it('prioritizes session permission signals', () => {
    const granted = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'denied',
      sessionMicPermission: 'granted',
      requestOutcome: 'denied',
    })
    const denied = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'granted',
      sessionMicPermission: 'denied',
      requestOutcome: 'granted',
    })

    expect(granted).toBe('granted')
    expect(denied).toBe('denied')
  })

  it('uses explicit request outcome when browser remains on prompt', () => {
    const granted = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'prompt',
      requestOutcome: 'granted',
    })
    const denied = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'prompt',
      requestOutcome: 'denied',
    })

    expect(granted).toBe('granted')
    expect(denied).toBe('denied')
  })

  it('uses browser permission when available', () => {
    const granted = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'granted',
      requestOutcome: 'denied',
    })
    const denied = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: 'denied',
      requestOutcome: 'granted',
    })

    expect(granted).toBe('granted')
    expect(denied).toBe('denied')
  })

  it('falls back to request outcome when browser permission is unavailable', () => {
    const granted = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: null,
      requestOutcome: 'granted',
    })
    const denied = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: null,
      requestOutcome: 'denied',
    })
    const unknown = resolveAudioPermissionState({
      isSupported: true,
      browserPermission: null,
      requestOutcome: 'none',
    })

    expect(granted).toBe('granted')
    expect(denied).toBe('denied')
    expect(unknown).toBe('unknown')
  })
})
