const END_TOKEN_REGEX = /<\s*end\s*>/gi

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

export const sanitizeSpeechText = (value: string) => {
  if (!value) {
    return ''
  }

  return normalizeWhitespace(value.replace(END_TOKEN_REGEX, ' '))
}
