export const resolveTranscriptDelta = (
  previousText: string,
  nextText: string,
) => {
  if (!nextText) {
    return ''
  }
  if (!previousText || nextText === previousText) {
    return nextText === previousText ? '' : nextText
  }
  if (nextText.startsWith(previousText)) {
    return nextText.slice(previousText.length)
  }

  const sharedPrefixLength = Math.min(previousText.length, nextText.length)
  let prefixLength = 0
  while (
    prefixLength < sharedPrefixLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1
  }
  return nextText.slice(prefixLength)
}
