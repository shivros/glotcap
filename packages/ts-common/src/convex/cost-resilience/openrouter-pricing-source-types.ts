import type { PricingRecord, PricingScope } from './pricing-domain'

export type OpenRouterRawModelRecord = Record<string, unknown>

export type OpenRouterPricingSourceRequest = {
  authToken?: string
  baseUrl?: string
  providerId?: string
  userId?: string
  profileId?: string
  scopeKey?: string
  ttlMs?: number
  signal?: AbortSignal
}

export type ResolvedOpenRouterPricingSourceRequest = {
  authToken: string
  baseUrl: string
  providerId: string
  userId?: string
  profileId?: string
  scopeKey?: string
  ttlMs?: number
  signal?: AbortSignal
  endpointUrl: string
}

export type OpenRouterPricingSourceSkipReason =
  | 'disabled'
  | 'missing_auth_token'

export type OpenRouterPricingSourceFailureReason =
  | 'request_failed'
  | 'invalid_response'

export type OpenRouterPricingSourceResult =
  | {
      status: 'fetched'
      records: ReadonlyArray<PricingRecord>
      fetchedAtMs: number
      scope: PricingScope
      endpointUrl: string
    }
  | {
      status: 'skipped'
      reason: OpenRouterPricingSourceSkipReason
    }
  | {
      status: 'failed'
      reason: OpenRouterPricingSourceFailureReason
      message: string
    }

export type OpenRouterModelsUserFetchRequest = {
  endpointUrl: string
  authToken: string
  signal?: AbortSignal
}

export interface OpenRouterModelsUserFetchPort {
  fetchModelsUser: (
    request: OpenRouterModelsUserFetchRequest,
  ) => Promise<unknown>
}
