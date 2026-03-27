import { afterEach, describe, expect, it } from 'vitest'
import { detectBrowserAudioCaptureCapabilities } from '@/lib/audio/browser-audio-capture-capabilities'

const originalNavigator = globalThis.navigator

const setNavigator = (value: unknown) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

describe('detectBrowserAudioCaptureCapabilities', () => {
  afterEach(() => {
    setNavigator(originalNavigator)
  })

  it('reports Chromium display-audio support when getDisplayMedia exists', () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      mediaDevices: {
        getDisplayMedia: () => Promise.resolve({}),
      },
    })

    const capabilities = detectBrowserAudioCaptureCapabilities()

    expect(capabilities.browserFamily).toBe('chromium')
    expect(capabilities.hasDisplayMedia).toBe(true)
    expect(capabilities.supportsDisplayAudioCapture).toBe(true)
    expect(capabilities.prefersDisplayAudioCapture).toBe(true)
  })

  it('reports no display-audio support in Firefox even when getDisplayMedia exists', () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
      mediaDevices: {
        getDisplayMedia: () => Promise.resolve({}),
      },
    })

    const capabilities = detectBrowserAudioCaptureCapabilities()

    expect(capabilities.browserFamily).toBe('firefox')
    expect(capabilities.hasDisplayMedia).toBe(true)
    expect(capabilities.supportsDisplayAudioCapture).toBe(false)
    expect(capabilities.prefersDisplayAudioCapture).toBe(false)
  })
})
