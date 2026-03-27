type IdleGapDebouncerConfig = {
  gapMs: number
  onFire: () => void
  shouldFire?: () => boolean
}

type IdleGapDebouncer = {
  schedule: () => void
  cancel: () => void
  dispose: () => void
}

export function createIdleGapDebouncer(
  config: IdleGapDebouncerConfig,
): IdleGapDebouncer {
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = () => {
    const { gapMs, onFire, shouldFire } = config

    if (shouldFire && !shouldFire()) {
      cancel()
      return
    }

    if (gapMs <= 0) {
      onFire()
      return
    }

    cancel()

    timer = setTimeout(() => {
      timer = null
      if (shouldFire && !shouldFire()) {
        return
      }
      onFire()
    }, gapMs)
  }

  const dispose = () => {
    cancel()
  }

  return { schedule, cancel, dispose }
}

export type { IdleGapDebouncer, IdleGapDebouncerConfig }
