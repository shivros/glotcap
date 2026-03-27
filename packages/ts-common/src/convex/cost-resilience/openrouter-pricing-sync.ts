import type {
  PricingRecord,
  PricingWriteRepositoryPort,
} from './pricing-domain'
import type {
  OpenRouterPricingSourcePort,
  OpenRouterPricingSourceRequest,
  OpenRouterPricingSourceResult,
} from './openrouter-pricing-source'

export type OpenRouterPricingSyncEntrypoint = 'background' | 'admin'

export type OpenRouterPricingSyncRequest = {
  entrypoint: OpenRouterPricingSyncEntrypoint
  sourceRequest?: OpenRouterPricingSourceRequest
}

export type OpenRouterPricingSyncSkipReason =
  | 'disabled'
  | 'entrypoint_not_allowed'
  | 'source_skipped'

export type OpenRouterPricingSyncFailureReason =
  | 'source_failed'
  | 'repository_write_failed'

export type OpenRouterPricingSyncResult =
  | {
      status: 'skipped'
      reason: OpenRouterPricingSyncSkipReason
      detail?: string
    }
  | {
      status: 'fetched'
      fetchedCount: number
      records: ReadonlyArray<PricingRecord>
    }
  | {
      status: 'synced'
      fetchedCount: number
      writtenCount: number
    }
  | {
      status: 'failed'
      reason: OpenRouterPricingSyncFailureReason
      message: string
    }

export interface OpenRouterPricingSyncPort<TCtx> {
  syncScopedPricing: (
    ctx: TCtx,
    request: OpenRouterPricingSyncRequest,
  ) => Promise<OpenRouterPricingSyncResult>
}

export type OpenRouterPricingSyncConfig<TCtx> = {
  source: OpenRouterPricingSourcePort<TCtx>
  repository?: PricingWriteRepositoryPort<TCtx>
  enabled?: boolean
  allowedEntrypoints?: ReadonlyArray<OpenRouterPricingSyncEntrypoint>
}

const defaultAllowedEntrypoints: ReadonlyArray<OpenRouterPricingSyncEntrypoint> =
  ['background', 'admin']

class OpenRouterPricingSyncService<
  TCtx,
> implements OpenRouterPricingSyncPort<TCtx> {
  private readonly enabled: boolean
  private readonly source: OpenRouterPricingSourcePort<TCtx>
  private readonly repository?: PricingWriteRepositoryPort<TCtx>
  private readonly allowedEntrypoints: ReadonlySet<OpenRouterPricingSyncEntrypoint>

  constructor(config: OpenRouterPricingSyncConfig<TCtx>) {
    this.enabled = config.enabled ?? false
    this.source = config.source
    this.repository = config.repository
    this.allowedEntrypoints = new Set(
      config.allowedEntrypoints ?? defaultAllowedEntrypoints,
    )
  }

  async syncScopedPricing(
    ctx: TCtx,
    request: OpenRouterPricingSyncRequest,
  ): Promise<OpenRouterPricingSyncResult> {
    if (!this.enabled) {
      return {
        status: 'skipped',
        reason: 'disabled',
      }
    }

    if (!this.allowedEntrypoints.has(request.entrypoint)) {
      return {
        status: 'skipped',
        reason: 'entrypoint_not_allowed',
        detail: request.entrypoint,
      }
    }

    const sourceResult = await this.source.fetchScopedPricingRecords(
      ctx,
      request.sourceRequest,
    )
    if (sourceResult.status !== 'fetched') {
      return mapSourceResultToSyncResult(sourceResult)
    }

    if (!this.repository) {
      return {
        status: 'fetched',
        fetchedCount: sourceResult.records.length,
        records: sourceResult.records,
      }
    }

    try {
      await this.repository.upsertPricingRecords(ctx, sourceResult.records)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown pricing repository write error.'
      return {
        status: 'failed',
        reason: 'repository_write_failed',
        message,
      }
    }

    return {
      status: 'synced',
      fetchedCount: sourceResult.records.length,
      writtenCount: sourceResult.records.length,
    }
  }
}

const mapSourceResultToSyncResult = (
  sourceResult: Exclude<OpenRouterPricingSourceResult, { status: 'fetched' }>,
): OpenRouterPricingSyncResult => {
  if (sourceResult.status === 'skipped') {
    return {
      status: 'skipped',
      reason: 'source_skipped',
      detail: sourceResult.reason,
    }
  }

  return {
    status: 'failed',
    reason: 'source_failed',
    message: sourceResult.message,
  }
}

export const createOpenRouterPricingSyncService = <TCtx>(
  config: OpenRouterPricingSyncConfig<TCtx>,
): OpenRouterPricingSyncPort<TCtx> => new OpenRouterPricingSyncService(config)
