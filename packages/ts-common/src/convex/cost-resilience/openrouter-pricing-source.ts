import { OPENROUTER_USER_MODELS_ENDPOINT } from './pricing-domain'
import { createOpenRouterPricingRequestResolver } from './openrouter-pricing-request-resolver'
import {
  createOpenRouterPricingRecordMapper,
  createOpenRouterPricingScopeFromRequest,
} from './openrouter-pricing-record-mapper'
import { createDefaultOpenRouterPricingResponseParser } from './openrouter-pricing-response-parser'
import type { PricingResolverClock } from './pricing-domain'
import type { OpenRouterPricingRecordMapperPort } from './openrouter-pricing-record-mapper'
import type { OpenRouterPricingRequestResolverPort } from './openrouter-pricing-request-resolver'
import type { OpenRouterPricingResponseParserPort } from './openrouter-pricing-response-parser'
import type { OpenRouterPricingValueStrategy } from './openrouter-pricing-value-strategy'
import type {
  OpenRouterModelsUserFetchPort,
  OpenRouterPricingSourceRequest,
  OpenRouterPricingSourceResult,
} from './openrouter-pricing-source-types'

export type {
  OpenRouterModelsUserFetchPort,
  OpenRouterModelsUserFetchRequest,
  OpenRouterPricingSourceFailureReason,
  OpenRouterPricingSourceRequest,
  OpenRouterPricingSourceResult,
  OpenRouterPricingSourceSkipReason,
  OpenRouterRawModelRecord,
  ResolvedOpenRouterPricingSourceRequest,
} from './openrouter-pricing-source-types'

const defaultClock: PricingResolverClock = {
  nowMs: () => Date.now(),
}

const defaultFetchPort: OpenRouterModelsUserFetchPort = {
  fetchModelsUser: async ({ endpointUrl, authToken, signal }) => {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
      signal,
    })
    if (!response.ok) {
      throw new Error(
        `OpenRouter pricing request failed with status ${response.status}.`,
      )
    }
    return response.json()
  },
}

export interface OpenRouterPricingSourcePort<TCtx> {
  fetchScopedPricingRecords: (
    ctx: TCtx,
    request?: OpenRouterPricingSourceRequest,
  ) => Promise<OpenRouterPricingSourceResult>
}

export type OpenRouterPricingSourceConfig<TCtx> = {
  enabled?: boolean
  sourceName?: string
  sourceId?: string
  clock?: PricingResolverClock
  /** Transport adapter used to retrieve `/api/v1/models/user`. */
  fetchPort?: OpenRouterModelsUserFetchPort
  /** Request normalization/gating extension point (auth/base URL/scope context). */
  requestResolver?: OpenRouterPricingRequestResolverPort<TCtx>
  /** Payload validation/parsing extension point for OpenRouter response changes. */
  responseParser?: OpenRouterPricingResponseParserPort
  /** Pricing record mapping extension point (scope + provenance + metadata). */
  recordMapper?: OpenRouterPricingRecordMapperPort
  /** Pricing value selection policy extension point used by the default mapper. */
  pricingValueStrategy?: OpenRouterPricingValueStrategy
  defaultRequest?: Partial<OpenRouterPricingSourceRequest>
  resolveRequest?: (
    ctx: TCtx,
    request: OpenRouterPricingSourceRequest,
  ) => OpenRouterPricingSourceRequest
  defaultTtlMs?: number
}

class HttpOpenRouterPricingSource<
  TCtx,
> implements OpenRouterPricingSourcePort<TCtx> {
  private readonly enabled: boolean
  private readonly sourceName: string
  private readonly sourceId: string
  private readonly clock: PricingResolverClock
  private readonly fetchPort: OpenRouterModelsUserFetchPort
  private readonly requestResolver: OpenRouterPricingRequestResolverPort<TCtx>
  private readonly responseParser: OpenRouterPricingResponseParserPort
  private readonly recordMapper: OpenRouterPricingRecordMapperPort

  constructor(config: OpenRouterPricingSourceConfig<TCtx>) {
    this.enabled = config.enabled ?? false
    this.sourceName = config.sourceName ?? 'openrouter_user_models'
    this.sourceId =
      config.sourceId ?? `openrouter:${OPENROUTER_USER_MODELS_ENDPOINT}`
    this.clock = config.clock ?? defaultClock
    this.fetchPort = config.fetchPort ?? defaultFetchPort
    this.requestResolver =
      config.requestResolver ??
      createOpenRouterPricingRequestResolver({
        defaultRequest: config.defaultRequest,
        resolveRequest: config.resolveRequest,
        defaultTtlMs: config.defaultTtlMs,
      })
    this.responseParser =
      config.responseParser ?? createDefaultOpenRouterPricingResponseParser()
    this.recordMapper =
      config.recordMapper ??
      createOpenRouterPricingRecordMapper({
        pricingValueStrategy: config.pricingValueStrategy,
      })
  }

  async fetchScopedPricingRecords(
    ctx: TCtx,
    request: OpenRouterPricingSourceRequest = {},
  ): Promise<OpenRouterPricingSourceResult> {
    if (!this.enabled) {
      return {
        status: 'skipped',
        reason: 'disabled',
      }
    }

    const resolvedRequest = this.requestResolver.resolveRequest(ctx, request)
    if (resolvedRequest.status !== 'ready') {
      return {
        status: 'skipped',
        reason: resolvedRequest.reason,
      }
    }

    let payload: unknown
    try {
      payload = await this.fetchPort.fetchModelsUser({
        endpointUrl: resolvedRequest.request.endpointUrl,
        authToken: resolvedRequest.request.authToken,
        signal: resolvedRequest.request.signal,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown OpenRouter request error.'
      return {
        status: 'failed',
        reason: 'request_failed',
        message,
      }
    }

    const parsed = this.responseParser.parseModelsUserPayload(payload)
    if (parsed.status !== 'parsed') {
      return {
        status: 'failed',
        reason: 'invalid_response',
        message: parsed.message,
      }
    }

    const fetchedAtMs = this.clock.nowMs()
    const records = this.recordMapper.mapRecords({
      models: parsed.models,
      request: resolvedRequest.request,
      fetchedAtMs,
      sourceName: this.sourceName,
      sourceId: this.sourceId,
    })
    const scope = createOpenRouterPricingScopeFromRequest(
      resolvedRequest.request,
    )

    return {
      status: 'fetched',
      records,
      fetchedAtMs,
      scope,
      endpointUrl: resolvedRequest.request.endpointUrl,
    }
  }
}

export const createOpenRouterPricingSource = <TCtx>(
  config: OpenRouterPricingSourceConfig<TCtx>,
): OpenRouterPricingSourcePort<TCtx> => new HttpOpenRouterPricingSource(config)
