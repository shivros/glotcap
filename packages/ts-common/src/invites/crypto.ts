import { INVITE_CODE_LENGTH } from './utils'

const INVITE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const getCrypto = () => (globalThis as { crypto?: Crypto }).crypto

export function generateInviteCode(length: number = INVITE_CODE_LENGTH) {
  const bytes = new Uint8Array(length)
  const cryptoObj = getCrypto()
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  let code = ''
  for (const value of bytes) {
    code += INVITE_ALPHABET[value % INVITE_ALPHABET.length]
  }
  return code
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashInviteCode(code: string) {
  const cryptoObj = getCrypto()
  if (!cryptoObj?.subtle) {
    throw new Error('crypto.subtle is not available')
  }
  const data = new TextEncoder().encode(code)
  const digest = await cryptoObj.subtle.digest('SHA-256', data)
  return toHex(digest)
}
