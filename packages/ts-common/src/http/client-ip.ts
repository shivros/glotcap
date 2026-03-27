export type ClientIpHeaders = Headers | Record<string, string | undefined>

const UNKNOWN_SENTINELS = new Set(['unknown', 'null', 'undefined', '-', ''])

const readHeader = (headers: ClientIpHeaders, key: string) => {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(key) ?? undefined
  }

  const rawHeaders = headers as Record<string, string | undefined>
  return rawHeaders[key] ?? rawHeaders[key.toLowerCase()]
}

const isLikelyIpv4 = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)
const isLikelyIpv6 = (value: string) => value.includes(':')

const stripPort = (value: string) => {
  if (value.startsWith('[') && value.includes(']')) {
    return value.slice(1, value.indexOf(']'))
  }

  const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/)
  if (ipv4WithPort) {
    return ipv4WithPort[1] ?? value
  }

  return value
}

export const normalizeClientIp = (value?: string | null) => {
  if (!value) {
    return null
  }

  const candidate = stripPort(value.trim()).replace(/%.+$/, '').toLowerCase()
  if (!candidate || UNKNOWN_SENTINELS.has(candidate)) {
    return null
  }

  if (candidate === '::1') {
    return '127.0.0.1'
  }

  if (!isLikelyIpv4(candidate) && !isLikelyIpv6(candidate)) {
    return null
  }

  return candidate
}

export const extractClientIp = (headers: ClientIpHeaders) => {
  const cfIp = normalizeClientIp(readHeader(headers, 'cf-connecting-ip'))
  if (cfIp) {
    return cfIp
  }

  const realIp = normalizeClientIp(readHeader(headers, 'x-real-ip'))
  if (realIp) {
    return realIp
  }

  const forwarded = readHeader(headers, 'x-forwarded-for')
  if (forwarded) {
    const firstHop = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .find(Boolean)
    const normalized = normalizeClientIp(firstHop)
    if (normalized) {
      return normalized
    }
  }

  return null
}

export const hashClientIp = (ip: string, salt = '') => {
  const value = `${salt}:${ip}`
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `ip_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const resolveClientIpFingerprint = (args: {
  headers: ClientIpHeaders
  salt?: string
  fallback?: string
}) => {
  const normalizedIp = extractClientIp(args.headers)
  const resolvedIp = normalizedIp ?? args.fallback ?? '0.0.0.0'

  return {
    ip: normalizedIp,
    fingerprint: hashClientIp(resolvedIp, args.salt),
  }
}
