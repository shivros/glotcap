export type BrowserFamily =
  | 'chromium'
  | 'firefox'
  | 'safari'
  | 'other'
  | 'unknown'

export type BrowserAudioCaptureCapabilities = {
  browserFamily: BrowserFamily
  hasDisplayMedia: boolean
  supportsDisplayAudioCapture: boolean
  prefersDisplayAudioCapture: boolean
}

const resolveUserAgent = () => {
  if (typeof navigator === 'undefined') {
    return ''
  }
  return navigator.userAgent.toLowerCase()
}

const detectBrowserFamily = (userAgent: string): BrowserFamily => {
  if (!userAgent) {
    return 'unknown'
  }
  if (userAgent.includes('firefox/')) {
    return 'firefox'
  }
  if (userAgent.includes('edg/') || userAgent.includes('chrome/')) {
    return 'chromium'
  }
  if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) {
    return 'safari'
  }
  return 'other'
}

const hasDisplayMediaSupport = () => {
  if (typeof navigator === 'undefined') {
    return false
  }

  const mediaDevices = navigator.mediaDevices as
    | (MediaDevices & { getDisplayMedia?: unknown })
    | undefined

  return Boolean(
    mediaDevices && typeof mediaDevices.getDisplayMedia === 'function',
  )
}

export const detectBrowserAudioCaptureCapabilities =
  (): BrowserAudioCaptureCapabilities => {
    const browserFamily = detectBrowserFamily(resolveUserAgent())
    const hasDisplayMedia = hasDisplayMediaSupport()
    const supportsDisplayAudioCapture =
      hasDisplayMedia && browserFamily === 'chromium'

    return {
      browserFamily,
      hasDisplayMedia,
      supportsDisplayAudioCapture,
      prefersDisplayAudioCapture: supportsDisplayAudioCapture,
    }
  }
