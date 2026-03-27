import type { SttCloseInfo } from './types'
import type { RuntimeSttConfig } from './session-bootstrap'

export type SttContext = {
  config: RuntimeSttConfig | null
  close: SttCloseInfo | null
}

export type SttContextStore = {
  get: () => SttContext
  set: (next: SttContext) => void
  reset: () => void
}

export const createRefBackedSttContextStore = (ref: {
  current: SttContext
}): SttContextStore => ({
  get: () => ref.current,
  set: (next) => {
    ref.current = next
  },
  reset: () => {
    ref.current = { config: null, close: null }
  },
})
