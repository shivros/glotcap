/**
 * Parsing Utilities
 *
 * Common parsing functions for various data formats.
 */

import he from 'he'

const { decode } = he

/**
 * Decode HTML entities into their literal characters.
 */
export function decodeHtmlEntities(input: string): string {
  return decode(input, { strict: false })
}

/**
 * Parse a memory string (e.g., "2g", "512m", "1024k") to bytes.
 *
 * Supported formats:
 * - Plain number: bytes (e.g., "1024" → 1024)
 * - With K/k suffix: kilobytes (e.g., "512k" → 524288)
 * - With M/m suffix: megabytes (e.g., "512m" → 536870912)
 * - With G/g suffix: gigabytes (e.g., "2g" → 2147483648)
 * - Optional "b" or "B" suffix (e.g., "512mb", "2GB")
 *
 * @param memory - Memory string to parse
 * @returns Number of bytes
 * @throws Error if format is invalid
 *
 * @example
 * parseMemory("2g")    // 2147483648
 * parseMemory("512m")  // 536870912
 * parseMemory("1024k") // 1048576
 * parseMemory("1024")  // 1024
 */
export function parseMemory(memory: string): number {
  const match = memory.match(/^(\d+(?:\.\d+)?)\s*([kmg])?b?$/i)
  if (!match || !match[1]) {
    throw new Error(
      `Invalid memory format: ${memory}. Expected format like "2g", "512m", "1024k", or plain bytes.`,
    )
  }

  const value = parseFloat(match[1])
  const unit = (match[2] ?? '').toLowerCase()

  switch (unit) {
    case 'k':
      return Math.floor(value * 1024)
    case 'm':
      return Math.floor(value * 1024 * 1024)
    case 'g':
      return Math.floor(value * 1024 * 1024 * 1024)
    default:
      return Math.floor(value)
  }
}

/**
 * Format bytes as a human-readable memory string.
 *
 * @param bytes - Number of bytes
 * @param precision - Decimal places (default: 1)
 * @returns Formatted string (e.g., "2.5 GB", "512 MB")
 *
 * @example
 * formatMemory(2147483648) // "2 GB"
 * formatMemory(536870912)  // "512 MB"
 * formatMemory(1536)       // "1.5 KB"
 */
export function formatMemory(bytes: number, precision: number = 1): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)

  return `${value.toFixed(precision).replace(/\.0+$/, '')} ${units[i]}`
}
