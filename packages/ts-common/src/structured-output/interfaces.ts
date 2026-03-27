export type StructuredOutputSchema = Record<string, unknown>

export type StructuredOutputUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type StructuredOutputRequest<T> = {
  schema: StructuredOutputSchema
  prompt: string
  system?: string
  model?: string
  temperature?: number
  maxTokens?: number
  guard?: (value: unknown) => value is T
  context?: Record<string, unknown>
}

export type StructuredOutputResult<T> = {
  value: T
  raw: unknown
  model?: string
  usage?: StructuredOutputUsage
}

export interface StructuredOutputClient {
  generate: <T>(
    request: StructuredOutputRequest<T>,
  ) => Promise<StructuredOutputResult<T>>
}

export class StructuredOutputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StructuredOutputValidationError'
  }
}

export const assertStructuredOutput = <T>(
  value: unknown,
  guard?: (value: unknown) => value is T,
) => {
  if (guard && !guard(value)) {
    throw new StructuredOutputValidationError(
      'Structured output failed validation.',
    )
  }
  return value as T
}
