import type { OpenRouterRawModelRecord } from './openrouter-pricing-source-types'

const isRecord = (value: unknown): value is OpenRouterRawModelRecord =>
  typeof value === 'object' && value !== null

export type OpenRouterPricingResponseParseResult =
  | {
      status: 'parsed'
      models: ReadonlyArray<OpenRouterRawModelRecord>
    }
  | {
      status: 'invalid'
      message: string
    }

export interface OpenRouterPricingResponseParserPort {
  parseModelsUserPayload: (
    payload: unknown,
  ) => OpenRouterPricingResponseParseResult
}

const invalidMessage =
  'OpenRouter /api/v1/models/user payload did not include a data array.'

const defaultParser: OpenRouterPricingResponseParserPort = {
  parseModelsUserPayload: (payload) => {
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      return {
        status: 'invalid',
        message: invalidMessage,
      }
    }

    return {
      status: 'parsed',
      models: payload.data.filter(isRecord),
    }
  },
}

export const createDefaultOpenRouterPricingResponseParser =
  (): OpenRouterPricingResponseParserPort => defaultParser
