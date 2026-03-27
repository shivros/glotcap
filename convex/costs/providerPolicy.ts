'use node'

import {
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'

const MODEL_PROVIDER_PREFIX_SEPARATOR = '/'

const DEFAULT_LLM_PROVIDER_ID = 'openrouter'
const DEFAULT_IMAGE_PROVIDER_ID = 'replicate'
const DEFAULT_TTS_PROVIDER_ID = 'elevenlabs'
const DEFAULT_STT_PROVIDER_ID = 'soniox'

export function resolveLlmCostProviderId(args: {
  providerName?: string
  modelId: string
}) {
  if (args.providerName?.trim()) {
    return normalizeCostProviderId(args.providerName)
  }

  const normalizedModelId = normalizeCostModelId(args.modelId)
  if (normalizedModelId.includes(MODEL_PROVIDER_PREFIX_SEPARATOR)) {
    return normalizedModelId.split(MODEL_PROVIDER_PREFIX_SEPARATOR)[0]
  }

  return DEFAULT_LLM_PROVIDER_ID
}

export function resolveImageCostProviderId(providerName?: string) {
  if (providerName?.trim()) {
    return normalizeCostProviderId(providerName)
  }
  return DEFAULT_IMAGE_PROVIDER_ID
}

export function resolveTtsCostProviderId(providerName?: string) {
  if (providerName?.trim()) {
    return normalizeCostProviderId(providerName)
  }
  return DEFAULT_TTS_PROVIDER_ID
}

export function resolveSttCostProviderId(providerName?: string) {
  if (providerName?.trim()) {
    return normalizeCostProviderId(providerName)
  }
  return DEFAULT_STT_PROVIDER_ID
}
