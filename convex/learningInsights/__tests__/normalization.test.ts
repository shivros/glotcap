import { describe, expect, it } from 'vitest'

import {
  deriveInsightLabel,
  getCorrectionExplanation,
  getCorrectionStrings,
  normalizeKey,
} from '../normalization'

const mockCorrectionEvent = (
  overrides: {
    payload?: { original?: string; corrected?: string }
    text?: string
  } = {},
) =>
  ({
    payload: {
      original: 'I goes to school',
      corrected: 'I go to school',
      ...overrides.payload,
    },
    text: 'I go to school',
    ...overrides,
  }) as any

describe('learningInsights normalization', () => {
  it('derives canonical labels from rules', () => {
    const label = deriveInsightLabel({
      title: 'Missing article',
      detail: 'Use the article “the”',
      category: 'Grammar',
    })
    expect(label?.canonical).toBe('articles')
    expect(label?.category).toBe('grammar')
  })

  it('falls back to a short canonical label', () => {
    const label = deriveInsightLabel({
      title: 'very long descriptive pattern for subjunctive mood',
      detail: '',
      category: '',
    })
    expect(label?.canonical).toBe('very long descriptive pattern')
  })

  it('normalizes canonical keys consistently', () => {
    expect(normalizeKey('Verb  Tense!')).toBe('verb tense')
  })

  it('uses payload original/corrected for examples', () => {
    const event = mockCorrectionEvent()
    const result = getCorrectionStrings(event, 'fallback transcript')
    expect(result).toEqual({
      original: 'I goes to school',
      corrected: 'I go to school',
    })
  })

  it('falls back to transcript text when original is missing', () => {
    const event = mockCorrectionEvent({
      payload: { original: '', corrected: 'I go to school' },
    })
    const result = getCorrectionStrings(event, 'I goes to school')
    expect(result).toEqual({
      original: 'I goes to school',
      corrected: 'I go to school',
    })
  })

  it('returns null when original equals corrected', () => {
    const event = mockCorrectionEvent({
      payload: { original: 'Same', corrected: 'Same' },
    })
    const result = getCorrectionStrings(event, 'Same')
    expect(result).toBeNull()
  })

  it('prefers detail as explanation', () => {
    const event = mockCorrectionEvent({
      payload: { original: 'I goes', corrected: 'I go' },
    })
    event.detail = 'Use the base verb form.'
    const explanation = getCorrectionExplanation(event)
    expect(explanation).toBe('Use the base verb form.')
  })

  it('falls back to title when detail is missing', () => {
    const event = mockCorrectionEvent({
      payload: { original: 'I goes', corrected: 'I go' },
    })
    event.title = 'Verb form'
    const explanation = getCorrectionExplanation(event)
    expect(explanation).toBe('Verb form')
  })
})
