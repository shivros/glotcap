import { canonicalRules } from './rules'
import type { Doc } from '../_generated/dataModel'

const shortenLabel = (value: string, maxWords = 4) => {
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return value
  }
  return words.slice(0, maxWords).join(' ')
}

export const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export type InsightLabel = {
  canonical: string
  canonicalKey: string
  category: string
  confidence: number
}

export const deriveInsightLabel = (correction: {
  title?: string | null
  detail?: string | null
  category?: string | null
}): InsightLabel | null => {
  const title = correction.title?.trim() ?? ''
  const category = correction.category?.trim() ?? ''
  const detail = correction.detail?.trim() ?? ''
  const matchText = normalizeKey(
    [title, category, detail].filter(Boolean).join(' '),
  )
  const normalizedCategory = normalizeKey(category)

  for (const rule of canonicalRules) {
    if (rule.pattern.test(matchText)) {
      return {
        canonical: rule.canonical,
        canonicalKey: normalizeKey(rule.canonical),
        category: normalizedCategory || rule.category,
        confidence: 1,
      }
    }
  }

  const fallbackSource = title || category
  const normalized = normalizeKey(fallbackSource)
  if (!normalized) {
    return null
  }
  const shortLabel = shortenLabel(normalized)
  const canonical = shortLabel.length > 0 ? shortLabel : normalized
  const derivedCategory = normalizedCategory || 'general'

  return {
    canonical,
    canonicalKey: normalizeKey(canonical),
    category: derivedCategory,
    confidence: 0.7,
  }
}

export const getCorrectionStrings = (
  event: Doc<'speakingEvents'>,
  transcriptText: string | null,
) => {
  const payload = event.payload as
    | {
        original?: string
        corrected?: string
      }
    | undefined
  const original = payload?.original?.trim() || transcriptText?.trim() || ''
  const corrected = payload?.corrected?.trim() || event.text?.trim() || ''
  if (!original || !corrected || original === corrected) {
    return null
  }
  return { original, corrected }
}

export const getCorrectionExplanation = (event: Doc<'speakingEvents'>) => {
  const payload = event.payload as
    | {
        detail?: string
        title?: string
      }
    | undefined
  const detail = event.detail?.trim() || payload?.detail?.trim() || ''
  const title = event.title?.trim() || payload?.title?.trim() || ''
  const explanation = detail || title
  return explanation || null
}
