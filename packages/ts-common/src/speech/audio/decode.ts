export const decodeAudioBuffer = (
  value: ArrayBuffer | Uint8Array | Array<number> | string,
): ArrayBuffer => {
  if (value instanceof ArrayBuffer) {
    return value
  }
  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    return new Uint8Array(value).slice().buffer
  }
  if (value instanceof Uint8Array) {
    if (value.buffer instanceof ArrayBuffer) {
      return value.buffer.slice(
        value.byteOffset,
        value.byteOffset + value.byteLength,
      )
    }
    const copy = new Uint8Array(value.byteLength)
    copy.set(value)
    return copy.buffer
  }
  if (typeof value === 'string') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value).buffer
  }
  return new Uint8Array(value as Iterable<number>).buffer
}
