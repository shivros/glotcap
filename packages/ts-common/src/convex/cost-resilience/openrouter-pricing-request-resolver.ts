import { normalizeCostProviderId } from '../cost-core'
import {
  DEFAULT_OPENROUTER_BASE_URL,
  OPENROUTER_USER_MODELS_ENDPOINT,
} from './pricing-domain'
import type {
  OpenRouterPricingSourceRequest,
  OpenRouterPricingSourceSkipReason,
  ResolvedOpenRouterPricingSourceRequest,
} from './openrouter-pricing-source-types'

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '')

const trimOptional = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export type OpenRouterPricingRequestResolveResult =
  | {
      status: 'ready'
      request: ResolvedOpenRouterPricingSourceRequest
    }
  | {
      status: 'skipped'
      reason: Extract<OpenRouterPricingSourceSkipReason, 'missing_auth_token'>
    }

export interface OpenRouterPricingRequestResolverPort<TCtx> {
  resolveRequest: (
    ctx: TCtx,
    request?: OpenRouterPricingSourceRequest,
  ) => OpenRouterPricingRequestResolveResult
}

export type OpenRouterPricingRequestResolverConfig<TCtx> = {
  defaultRequest?: Partial<OpenRouterPricingSourceRequest>
  resolveRequest?: (
    ctx: TCtx,
    request: OpenRouterPricingSourceRequest,
  ) => OpenRouterPricingSourceRequest
  defaultBaseUrl?: string
  defaultProviderId?: string
  defaultTtlMs?: number
}

class OpenRouterPricingRequestResolver<
  TCtx,
> implements OpenRouterPricingRequestResolverPort<TCtx> {
  constructor(
    private readonly config: OpenRouterPricingRequestResolverConfig<TCtx>,
  ) {}

  resolveRequest(
    ctx: TCtx,
    request: OpenRouterPricingSourceRequest = {},
  ): OpenRouterPricingRequestResolveResult {
    const mergedRequest = {
      ...(this.config.defaultRequest ?? {}),
      ...request,
    } satisfies OpenRouterPricingSourceRequest
    const resolvedRequest = this.config.resolveRequest
      ? this.config.resolveRequest(ctx, mergedRequest)
      : mergedRequest

    const authToken = resolvedRequest.authToken?.trim()
    if (!authToken) {
      return {
        status: 'skipped',
        reason: 'missing_auth_token',
      }
    }

    const baseUrl = normalizeBaseUrl(
      resolvedRequest.baseUrl ??
        this.config.defaultBaseUrl ??
        DEFAULT_OPENROUTER_BASE_URL,
    )
    const providerId = normalizeCostProviderId(
      resolvedRequest.providerId ??
        this.config.defaultProviderId ??
        'openrouter',
    )
    const ttlMs =
      typeof resolvedRequest.ttlMs === 'number'
        ? resolvedRequest.ttlMs
        : this.config.defaultTtlMs

    return {
      status: 'ready',
      request: {
        authToken,
        baseUrl,
        providerId,
        userId: trimOptional(resolvedRequest.userId),
        profileId: trimOptional(resolvedRequest.profileId),
        scopeKey: trimOptional(resolvedRequest.scopeKey),
        ttlMs,
        signal: resolvedRequest.signal,
        endpointUrl: new URL(
          OPENROUTER_USER_MODELS_ENDPOINT,
          `${baseUrl}/`,
        ).toString(),
      },
    }
  }
}

export const createOpenRouterPricingRequestResolver = <TCtx>(
  config: OpenRouterPricingRequestResolverConfig<TCtx> = {},
): OpenRouterPricingRequestResolverPort<TCtx> =>
  new OpenRouterPricingRequestResolver(config)
