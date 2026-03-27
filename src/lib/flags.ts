import { createEdgeConfigGetter } from 'ts-common/flags'
import type { UnderConstructionFlags } from 'ts-common/flags'

const CONFIG_NAME = 'glotcap-ui'

type GlotcapFlags = UnderConstructionFlags

const getFlag = createEdgeConfigGetter<GlotcapFlags>(CONFIG_NAME)

export async function isUnderConstruction(): Promise<boolean> {
  return getFlag('underConstruction', false)
}
