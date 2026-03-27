import { sanitizeSpeechText } from '@/lib/speaking-session-text'

const DEFAULT_FLUSH_MS = 700
const DEFAULT_MAX_WAIT_MS = 1800
const DEFAULT_MIN_CHARS = 20
const DEFAULT_MIN_WORDS = 4
const DEFAULT_PREEMPT_AFTER_MS = 1500
const DEFAULT_PREEMPT_MIN_PENDING_CHARS = 24

type SourceState = {
  sourceText: string
  committedSourceText: string
  translatedText: string
  lastSentSegment: string
  pendingSince: number | null
  lastFlushAt: number
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  inFlightStartedAt: number | null
  needsFlush: boolean
  forceFlushPending: boolean
  revision: number
}

type FlushReason = 'timer' | 'immediate' | 'force'

export type LiveTranslationRequestContext = {
  sourceId: string
  reason: FlushReason
  revision: number
}

export type LiveTranslationTelemetryEvent = {
  stage:
    | 'flush_skipped'
    | 'flush_coalesced'
    | 'request_preempted'
    | 'request_started'
    | 'request_completed'
    | 'request_failed'
  sourceId: string
  reason?: FlushReason
  segmentChars?: number
  pendingChars?: number
  revision?: number
  requestMs?: number
}

export type LiveTranslationCoordinatorOptions = {
  translate: (
    text: string,
    context?: LiveTranslationRequestContext,
  ) => Promise<string>
  onUpdate: (sourceId: string, translation: string) => void
  onError?: (err: unknown, context: { sourceId: string; text: string }) => void
  onTelemetry?: (event: LiveTranslationTelemetryEvent) => void
  isEnabled?: () => boolean
  flushMs?: number
  maxWaitMs?: number
  minChars?: number
  minWords?: number
  preemptAfterMs?: number
  preemptMinPendingChars?: number
  now?: () => number
}

export type UpdateTranslationSourceOptions = {
  force?: boolean
  immediate?: boolean
}

const SENTENCE_END_PATTERN = /[.!?…।！？]+(?:["')\]]|\s)*$/

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length

const hasSentenceEnd = (text: string) => SENTENCE_END_PATTERN.test(text)

const createState = (): SourceState => ({
  sourceText: '',
  committedSourceText: '',
  translatedText: '',
  lastSentSegment: '',
  pendingSince: null,
  lastFlushAt: 0,
  timer: null,
  inFlight: false,
  inFlightStartedAt: null,
  needsFlush: false,
  forceFlushPending: false,
  revision: 0,
})

export class LiveTranslationCoordinator {
  private readonly states = new Map<string, SourceState>()

  private readonly translate: LiveTranslationCoordinatorOptions['translate']

  private readonly onUpdate: LiveTranslationCoordinatorOptions['onUpdate']

  private readonly onError: LiveTranslationCoordinatorOptions['onError']

  private readonly onTelemetry: LiveTranslationCoordinatorOptions['onTelemetry']

  private readonly isEnabled: () => boolean

  private readonly flushMs: number

  private readonly maxWaitMs: number

  private readonly minChars: number

  private readonly minWords: number

  private readonly preemptAfterMs: number

  private readonly preemptMinPendingChars: number

  private readonly now: () => number

  constructor(options: LiveTranslationCoordinatorOptions) {
    this.translate = options.translate
    this.onUpdate = options.onUpdate
    this.onError = options.onError
    this.onTelemetry = options.onTelemetry
    this.isEnabled = options.isEnabled ?? (() => true)
    this.flushMs = options.flushMs ?? DEFAULT_FLUSH_MS
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS
    this.minChars = options.minChars ?? DEFAULT_MIN_CHARS
    this.minWords = options.minWords ?? DEFAULT_MIN_WORDS
    this.preemptAfterMs = options.preemptAfterMs ?? DEFAULT_PREEMPT_AFTER_MS
    this.preemptMinPendingChars =
      options.preemptMinPendingChars ?? DEFAULT_PREEMPT_MIN_PENDING_CHARS
    this.now = options.now ?? (() => Date.now())
  }

  updateSource(
    sourceId: string,
    sourceText: string,
    options: UpdateTranslationSourceOptions = {},
  ) {
    const cleaned = sanitizeSpeechText(sourceText)
    if (!cleaned) {
      return
    }

    const state = this.getState(sourceId)
    const priorSourceText = state.sourceText

    if (priorSourceText === cleaned) {
      if (options.force) {
        this.flush(sourceId, 'force')
        return
      }
      if (this.hasPending(state)) {
        if (options.immediate || this.shouldFlushImmediately(state, cleaned)) {
          this.flush(sourceId, 'immediate')
        } else {
          this.ensureTimer(sourceId)
        }
      }
      return
    }

    state.sourceText = cleaned

    if (!cleaned.startsWith(state.committedSourceText)) {
      this.resetCommittedState(state)
    }

    if (!this.hasPending(state)) {
      this.clearTimer(state)
      return
    }

    const immediate =
      options.force ||
      options.immediate ||
      this.shouldFlushImmediately(state, cleaned)

    if (immediate) {
      this.flush(sourceId, options.force ? 'force' : 'immediate')
      return
    }

    this.ensureTimer(sourceId)
  }

  appendDelta(
    sourceId: string,
    deltaText: string,
    options: UpdateTranslationSourceOptions = {},
  ) {
    const state = this.getState(sourceId)
    const combined = sanitizeSpeechText(`${state.sourceText}${deltaText}`)
    if (!combined) {
      return
    }
    this.updateSource(sourceId, combined, options)
  }

  completeSource(sourceId: string, sourceText?: string) {
    if (sourceText) {
      this.updateSource(sourceId, sourceText, { force: true })
      return
    }
    this.flush(sourceId, 'force')
  }

  clearPending() {
    this.states.forEach((state) => {
      this.clearTimer(state)
      state.pendingSince = null
      state.lastSentSegment = ''
      state.inFlightStartedAt = null
      state.needsFlush = false
      state.forceFlushPending = false
    })
  }

  reset() {
    this.states.forEach((state) => {
      this.clearTimer(state)
    })
    this.states.clear()
  }

  private getState(sourceId: string) {
    const existing = this.states.get(sourceId)
    if (existing) {
      return existing
    }
    const state = createState()
    this.states.set(sourceId, state)
    return state
  }

  private hasPending(state: SourceState) {
    return state.sourceText.length > state.committedSourceText.length
  }

  private getPendingSegment(state: SourceState) {
    if (!this.hasPending(state)) {
      return ''
    }
    const pending = state.sourceText.slice(state.committedSourceText.length)
    return sanitizeSpeechText(pending)
  }

  private clearTimer(state: SourceState) {
    if (!state.timer) {
      return
    }
    clearTimeout(state.timer)
    state.timer = null
  }

  private resetCommittedState(state: SourceState) {
    state.committedSourceText = ''
    state.translatedText = ''
    state.lastSentSegment = ''
    state.pendingSince = null
  }

  private ensureTimer(sourceId: string) {
    const state = this.getState(sourceId)
    if (state.timer || !this.isEnabled()) {
      return
    }
    state.timer = setTimeout(() => {
      state.timer = null
      this.flush(sourceId, 'timer')
    }, this.flushMs)
  }

  private shouldFlushImmediately(state: SourceState, sourceText: string) {
    if (hasSentenceEnd(sourceText)) {
      return true
    }
    if (state.pendingSince === null) {
      state.pendingSince = this.now()
      return false
    }
    return this.now() - state.pendingSince >= this.maxWaitMs
  }

  private shouldSendSegment(segment: string, reason: FlushReason) {
    if (reason === 'force') {
      return true
    }
    if (hasSentenceEnd(segment)) {
      return true
    }
    if (segment.length >= this.minChars) {
      return true
    }
    return countWords(segment) >= this.minWords
  }

  private shouldPreempt(
    state: SourceState,
    reason: FlushReason,
    segmentChars: number,
  ) {
    if (reason === 'timer') {
      return false
    }
    if (state.inFlightStartedAt === null) {
      return false
    }
    if (segmentChars < this.preemptMinPendingChars) {
      return false
    }
    return this.now() - state.inFlightStartedAt >= this.preemptAfterMs
  }

  private flush(sourceId: string, reason: FlushReason) {
    if (!this.isEnabled()) {
      return
    }

    const state = this.getState(sourceId)
    this.clearTimer(state)

    const segment = this.getPendingSegment(state)
    if (!segment) {
      state.pendingSince = null
      return
    }

    if (!this.shouldSendSegment(segment, reason)) {
      if (state.pendingSince === null) {
        state.pendingSince = this.now()
      }
      if (this.now() - state.pendingSince >= this.maxWaitMs) {
        this.flush(sourceId, 'force')
        return
      }
      this.onTelemetry?.({
        stage: 'flush_skipped',
        sourceId,
        reason,
        segmentChars: segment.length,
        pendingChars:
          state.sourceText.length - state.committedSourceText.length,
      })
      this.ensureTimer(sourceId)
      return
    }

    if (segment === state.lastSentSegment && reason !== 'force') {
      this.ensureTimer(sourceId)
      return
    }

    if (state.inFlight) {
      if (this.shouldPreempt(state, reason, segment.length)) {
        const inFlightMs =
          state.inFlightStartedAt === null
            ? undefined
            : this.now() - state.inFlightStartedAt
        state.inFlight = false
        state.inFlightStartedAt = null
        state.revision += 1
        state.needsFlush = false
        state.forceFlushPending = false
        this.onTelemetry?.({
          stage: 'request_preempted',
          sourceId,
          reason,
          segmentChars: segment.length,
          pendingChars:
            state.sourceText.length - state.committedSourceText.length,
          revision: state.revision,
          requestMs: inFlightMs,
        })
      } else {
        state.needsFlush = true
        if (reason === 'force') {
          state.forceFlushPending = true
        }
        this.onTelemetry?.({
          stage: 'flush_coalesced',
          sourceId,
          reason,
          segmentChars: segment.length,
          pendingChars:
            state.sourceText.length - state.committedSourceText.length,
          revision: state.revision,
        })
        if (state.pendingSince === null) {
          state.pendingSince = this.now()
        }
        this.ensureTimer(sourceId)
        return
      }
    }

    state.lastSentSegment = segment
    state.lastFlushAt = this.now()
    const snapshotSourceText = state.sourceText
    const revision = state.revision + 1
    state.revision = revision
    state.inFlight = true
    state.inFlightStartedAt = this.now()
    state.needsFlush = false
    state.forceFlushPending = false
    const requestStartedAt = this.now()
    this.onTelemetry?.({
      stage: 'request_started',
      sourceId,
      reason,
      segmentChars: segment.length,
      pendingChars: state.sourceText.length - state.committedSourceText.length,
      revision,
    })

    const execute = async () => {
      try {
        const translatedSegment = await this.translate(segment, {
          sourceId,
          reason,
          revision,
        })
        const activeState = this.states.get(sourceId)
        if (!activeState || activeState.revision !== revision) {
          return
        }

        if (!activeState.sourceText.startsWith(snapshotSourceText)) {
          this.resetCommittedState(activeState)
          return
        }

        activeState.committedSourceText = snapshotSourceText
        activeState.pendingSince = null
        activeState.translatedText = sanitizeSpeechText(
          activeState.translatedText
            ? `${activeState.translatedText} ${translatedSegment}`
            : translatedSegment,
        )
        this.onUpdate(sourceId, activeState.translatedText)
        this.onTelemetry?.({
          stage: 'request_completed',
          sourceId,
          reason,
          segmentChars: segment.length,
          pendingChars:
            activeState.sourceText.length -
            activeState.committedSourceText.length,
          revision,
          requestMs: this.now() - requestStartedAt,
        })
      } catch (err) {
        this.onTelemetry?.({
          stage: 'request_failed',
          sourceId,
          reason,
          segmentChars: segment.length,
          pendingChars:
            state.sourceText.length - state.committedSourceText.length,
          revision,
          requestMs: this.now() - requestStartedAt,
        })
        if (this.onError) {
          this.onError(err, { sourceId, text: segment })
        }
      } finally {
        let nextAction: 'none' | 'force' | 'immediate' | 'timer' = 'none'
        const activeState = this.states.get(sourceId)
        if (activeState && activeState.revision === revision) {
          activeState.inFlight = false
          activeState.inFlightStartedAt = null

          if (!this.hasPending(activeState)) {
            activeState.needsFlush = false
            activeState.forceFlushPending = false
            nextAction = 'none'
          } else if (activeState.forceFlushPending) {
            nextAction = 'force'
          } else if (
            activeState.needsFlush ||
            this.shouldFlushImmediately(activeState, activeState.sourceText)
          ) {
            nextAction = 'immediate'
          } else {
            nextAction = 'timer'
          }
        }

        if (nextAction === 'force') {
          this.flush(sourceId, 'force')
        } else if (nextAction === 'immediate') {
          this.flush(sourceId, 'immediate')
        } else if (nextAction === 'timer') {
          this.ensureTimer(sourceId)
        }
      }
    }
    void execute()
  }
}
