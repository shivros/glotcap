export const resolveConvexSiteUrl = (convexUrl: string, explicit?: string) => {
  if (explicit) {
    return explicit
  }

  try {
    const url = new URL(convexUrl)
    if (url.hostname.endsWith('.convex.cloud')) {
      url.hostname = url.hostname.replace('.convex.cloud', '.convex.site')
      return url.toString()
    }
    if (url.port === '3210') {
      url.port = '3211'
      return url.toString()
    }
    return url.toString()
  } catch {
    return convexUrl
  }
}
