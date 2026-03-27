'use node'

export function isMissingPricingError(
  error: unknown,
  target: 'model' | 'tool',
) {
  if (!(error instanceof Error)) {
    return false
  }
  const message = error.message.toLowerCase()
  return target === 'model'
    ? message.includes('pricing not found for model')
    : message.includes('pricing not found for tool')
}
