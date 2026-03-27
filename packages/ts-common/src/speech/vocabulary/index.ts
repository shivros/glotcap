import type { StructuredOutputSchema } from '../../structured-output'

export type VocabularyItem = {
  word: string
  definition: string
}

export type VocabularyResult = {
  vocabulary: Array<VocabularyItem>
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const isVocabularyResult = (
  value: unknown,
): value is VocabularyResult => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const result = value as { vocabulary?: unknown }
  if (!Array.isArray(result.vocabulary)) {
    return false
  }

  return result.vocabulary.every((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const candidate = item as Record<string, unknown>
    return (
      isNonEmptyString(candidate.word) && isNonEmptyString(candidate.definition)
    )
  })
}

export const vocabularySchema: StructuredOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          word: { type: 'string' },
          definition: { type: 'string' },
        },
        required: ['word', 'definition'],
      },
    },
  },
  required: ['vocabulary'],
}

const normalizeWord = (value: string) => value.trim()
const normalizeDefinition = (value: string) => value.trim()

export const normalizeVocabulary = (
  vocabulary: Array<VocabularyItem>,
  options: { max?: number } = {},
) => {
  const max = Math.max(options.max ?? 3, 0)
  const seen = new Set<string>()

  return vocabulary
    .map((item) => ({
      word: normalizeWord(item.word),
      definition: normalizeDefinition(item.definition),
    }))
    .filter((item) => {
      if (!item.word || !item.definition) {
        return false
      }
      if (item.word.length < 3) {
        return false
      }
      const key = item.word.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .slice(0, max)
}

export const buildVocabularySystemPrompt = ({
  targetLanguage,
  sourceLanguage,
  maxVocabulary = 3,
}: {
  targetLanguage: string
  sourceLanguage: string
  maxVocabulary?: number
}) => {
  return [
    'You are a language tutor extracting helpful vocabulary from a conversation turn.',
    `The learner is practicing ${targetLanguage}.`,
    'Return structured vocabulary only; do not chat or respond to the learner.',
    `Return at most ${maxVocabulary} items.`,
    'Never include words the learner already used.',
    'Avoid filler, function words, and trivial items. If nothing is useful, return an empty list.',
    `Write definitions in ${sourceLanguage}.`,
  ].join(' ')
}

export const buildVocabularyPrompt = ({
  text,
  targetLanguage,
  sourceLanguage,
  excludeText,
}: {
  text: string
  targetLanguage: string
  sourceLanguage: string
  excludeText?: string
}) =>
  [
    `Target language: ${targetLanguage}.`,
    `Definition language: ${sourceLanguage}.`,
    `Learner utterance: """${text}"""`,
    excludeText
      ? `Do not return any word that appears in the learner utterance: """${excludeText}""".`
      : '',
    'Extract useful vocabulary from the utterance only.',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
