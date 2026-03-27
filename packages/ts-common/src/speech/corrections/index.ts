import type { StructuredOutputSchema } from '../../structured-output'

export const correctionSeverities = [
  'low',
  'medium',
  'high',
  'positive',
] as const

export type CorrectionSeverity = (typeof correctionSeverities)[number]

export type CorrectionItem = {
  title: string
  detail: string
  original: string
  corrected: string
  severity: CorrectionSeverity
  category: string
}

export type CorrectionsResult = {
  corrections: Array<CorrectionItem>
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const isCorrectionsResult = (
  value: unknown,
): value is CorrectionsResult => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const result = value as { corrections?: unknown }
  if (!Array.isArray(result.corrections)) {
    return false
  }

  return result.corrections.every((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const candidate = item as Record<string, unknown>
    return (
      isNonEmptyString(candidate.title) &&
      isNonEmptyString(candidate.detail) &&
      isNonEmptyString(candidate.original) &&
      isNonEmptyString(candidate.corrected) &&
      isNonEmptyString(candidate.category) &&
      correctionSeverities.includes(candidate.severity as CorrectionSeverity)
    )
  })
}

export const correctionsSchema: StructuredOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          original: { type: 'string' },
          corrected: { type: 'string' },
          severity: { type: 'string', enum: [...correctionSeverities] },
          category: { type: 'string' },
        },
        required: [
          'title',
          'detail',
          'original',
          'corrected',
          'severity',
          'category',
        ],
      },
    },
  },
  required: ['corrections'],
}

export const normalizeCorrections = (
  corrections: Array<CorrectionItem>,
  options: { max?: number } = {},
) => {
  const max = Math.max(options.max ?? 4, 0)
  return corrections
    .map((item) => ({
      ...item,
      title: item.title.trim(),
      detail: item.detail.trim(),
      original: item.original.trim(),
      corrected: item.corrected.trim(),
      category: item.category.trim(),
    }))
    .filter(
      (item) =>
        item.title &&
        item.detail &&
        item.original &&
        item.corrected &&
        item.category &&
        correctionSeverities.includes(item.severity),
    )
    .slice(0, max)
}

export const buildCorrectionsSystemPrompt = ({
  targetLanguage,
  sourceLanguage,
  maxCorrections = 4,
}: {
  targetLanguage: string
  sourceLanguage?: string
  maxCorrections?: number
}) => {
  const explanationLanguage = sourceLanguage ?? targetLanguage
  return [
    'You are a language tutor generating correction notes.',
    `The learner is practicing ${targetLanguage}.`,
    'Return structured correction data only; do not chat or respond to the learner.',
    `Limit to at most ${maxCorrections} high-impact corrections.`,
    'Avoid nitpicks. If the utterance is natural, return an empty list.',
    `Write correction explanations in ${explanationLanguage}.`,
  ].join(' ')
}

export const buildCorrectionsPrompt = ({
  text,
  targetLanguage,
  sourceLanguage,
  context,
}: {
  text: string
  targetLanguage: string
  sourceLanguage?: string
  context?: Array<string>
}) => {
  const contextBlock =
    context && context.length > 0
      ? `Recent context:\n${context.map((line) => `- ${line}`).join('\n')}`
      : ''
  return [
    `Target language: ${targetLanguage}.`,
    sourceLanguage
      ? `Learner reference language: ${sourceLanguage}.`
      : 'Learner reference language: none.',
    `Learner utterance: """${text}"""`,
    contextBlock,
    'Provide corrections for the learner utterance only.',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}
