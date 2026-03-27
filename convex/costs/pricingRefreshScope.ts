'use node'

import {
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'
import type {
  AICostArgs,
  AIPricingRefreshRequest,
} from 'ts-common/convex/costs'

export function resolveAIPricingRefreshRequest(
  args: AICostArgs,
): AIPricingRefreshRequest {
  const providerId = normalizeCostProviderId(args.providerId)
  const modelId = normalizeCostModelId(args.modelId)

  // Keep runtime decoupled from live OpenRouter fetches while shaping
  // future support for scoped model retrieval through /api/v1/models/user.
  if (providerId === 'openrouter') {
    return {
      reason: 'missing_pricing_retry',
      scope: {
        type: 'openrouterUserModels',
        endpoint: '/api/v1/models/user',
        providerId,
        userId: args.userId,
      },
    }
  }

  return {
    reason: 'missing_pricing_retry',
    scope: {
      type: 'providerModel',
      providerId,
      modelId,
    },
  }
}
