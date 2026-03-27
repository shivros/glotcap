import { createIdleGapDebouncer } from './idle-gap-debouncer'

export type ConversationTurnScheduledFlush<
  TIdentity extends string = string,
  TTrigger extends string = string,
> = {
  identity: TIdentity
  lifecycleToken: number
  trigger: TTrigger
}

type ConversationTurnFlushSchedulerConfig<
  TIdentity extends string = string,
  TTrigger extends string = string,
> = {
  gapMs: number
  isActive: () => boolean
  getLifecycleToken: () => number
  onFire: (
    schedule: ConversationTurnScheduledFlush<TIdentity, TTrigger>,
  ) => void
}

export type ConversationTurnFlushScheduler<
  TIdentity extends string = string,
  TTrigger extends string = string,
> = {
  schedule: (args: { identity: TIdentity; trigger: TTrigger }) => void
  cancel: () => void
  getSchedule: () => ConversationTurnScheduledFlush<TIdentity, TTrigger> | null
  dispose: () => void
}

export const createConversationTurnFlushScheduler = <
  TIdentity extends string = string,
  TTrigger extends string = string,
>(
  config: ConversationTurnFlushSchedulerConfig<TIdentity, TTrigger>,
): ConversationTurnFlushScheduler<TIdentity, TTrigger> => {
  let scheduled: ConversationTurnScheduledFlush<TIdentity, TTrigger> | null =
    null

  const clearScheduled = () => {
    scheduled = null
  }

  const debouncer = createIdleGapDebouncer({
    gapMs: config.gapMs,
    shouldFire: () => config.isActive() && scheduled !== null,
    onFire: () => {
      const current = scheduled
      clearScheduled()
      if (!current) {
        return
      }
      config.onFire(current)
    },
  })

  return {
    schedule({ identity, trigger }) {
      if (!config.isActive()) {
        clearScheduled()
        debouncer.cancel()
        return
      }

      scheduled = {
        identity,
        trigger,
        lifecycleToken: config.getLifecycleToken(),
      }
      debouncer.schedule()
    },
    cancel() {
      clearScheduled()
      debouncer.cancel()
    },
    getSchedule() {
      return scheduled
    },
    dispose() {
      clearScheduled()
      debouncer.dispose()
    },
  }
}
