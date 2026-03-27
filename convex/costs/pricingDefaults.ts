'use node'

import {
  normalizeCostModelId,
  normalizeCostProviderId,
} from 'ts-common/convex/costs'
import type {
  ToolCostArgs,
  ToolPricingUpsertArgs,
} from 'ts-common/convex/costs'

const DEFAULT_IMAGE_COST_PER_UNIT_USD = 0.04
const DEFAULT_CHARACTER_COST_PER_UNIT_USD = 0.000002
const DEFAULT_AUDIO_SECOND_COST_PER_UNIT_USD = 0.0002
const DEFAULT_SESSION_COST_PER_UNIT_USD = 0.002
const DEFAULT_UNIT_COST_PER_UNIT_USD = 0.01

const parsePositiveEnvNumber = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

export function resolveUnitCostPerUnitUsd(unitType: string) {
  const normalizedUnitType = unitType.trim().toLowerCase()

  if (normalizedUnitType === 'images') {
    return (
      parsePositiveEnvNumber(process.env.REPLICATE_IMAGE_COST_PER_IMAGE_USD) ??
      DEFAULT_IMAGE_COST_PER_UNIT_USD
    )
  }

  if (normalizedUnitType === 'characters') {
    return (
      parsePositiveEnvNumber(
        process.env.LLM_CHARACTER_COST_PER_CHARACTER_USD,
      ) ??
      parsePositiveEnvNumber(
        process.env.TTS_CHARACTER_COST_PER_CHARACTER_USD,
      ) ??
      DEFAULT_CHARACTER_COST_PER_UNIT_USD
    )
  }

  if (normalizedUnitType === 'audio_seconds') {
    return (
      parsePositiveEnvNumber(process.env.STT_COST_PER_AUDIO_SECOND_USD) ??
      DEFAULT_AUDIO_SECOND_COST_PER_UNIT_USD
    )
  }

  if (normalizedUnitType === 'sessions') {
    return (
      parsePositiveEnvNumber(process.env.STT_COST_PER_SESSION_USD) ??
      DEFAULT_SESSION_COST_PER_UNIT_USD
    )
  }

  return (
    parsePositiveEnvNumber(process.env.TOOL_DEFAULT_COST_PER_UNIT_USD) ??
    DEFAULT_UNIT_COST_PER_UNIT_USD
  )
}

export function resolveToolPricingUpsertArgs(
  args: ToolCostArgs,
): ToolPricingUpsertArgs {
  const unitType = args.unitType?.trim() || 'units'
  return {
    providerId: normalizeCostProviderId(args.providerId),
    providerName:
      args.providerId.trim() || normalizeCostProviderId(args.providerId),
    toolId: normalizeCostModelId(args.toolId),
    unitType,
    costPerUnitUsd: resolveUnitCostPerUnitUsd(unitType),
  }
}
