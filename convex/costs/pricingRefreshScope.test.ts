// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { resolveAIPricingRefreshRequest } from './pricingRefreshScope'

describe('pricingRefreshScope', () => {
  it('builds openrouter user-model refresh scope for openrouter providers', () => {
    const request = resolveAIPricingRefreshRequest({
      messageId: 'msg_3',
      threadId: 'thread_1',
      userId: 'user_1',
      providerId: 'openrouter',
      modelId: 'openai/gpt-4o-mini',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    })

    expect(request).toEqual({
      reason: 'missing_pricing_retry',
      scope: {
        type: 'openrouterUserModels',
        endpoint: '/api/v1/models/user',
        providerId: 'openrouter',
        userId: 'user_1',
      },
    })
  })

  it('builds provider/model refresh scope for non-openrouter providers', () => {
    const request = resolveAIPricingRefreshRequest({
      messageId: 'msg_4',
      threadId: 'thread_1',
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    })

    expect(request).toEqual({
      reason: 'missing_pricing_retry',
      scope: {
        type: 'providerModel',
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
      },
    })
  })
})
