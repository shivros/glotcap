import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import type {
  MicPermission,
  SpeakingSessionMode,
  SpeakingSessionOptions,
  SpeakingSessionStatus,
} from '@/lib/speaking-session-types'
import type { SessionTerminationReason } from '../../shared/speaking-session-domain'

const DEMO_ID_KEY = 'glotcap-demo-id'

type StartSessionResult = {
  sessionId: Id<'speakingSessions'>
  mode: SpeakingSessionMode
  limitMs: number
  usageMs: number
}

type StartSession = (args: {
  mode?: SpeakingSessionMode
  demoId?: string
  targetLanguage: string
  sourceLanguage?: string
  limitMs?: number
  turnId?: string
}) => Promise<StartSessionResult>

type EndSession = (args: {
  sessionId: Id<'speakingSessions'>
  terminationReason?: 'manual' | 'limit_reached' | 'error'
}) => Promise<{ status: string }>

type SessionLifecycleParams = {
  options: SpeakingSessionOptions
  status: SpeakingSessionStatus
  setStatus: (status: SpeakingSessionStatus) => void
  setMode: (mode: SpeakingSessionMode | null) => void
  setSessionId: (sessionId: Id<'speakingSessions'> | null) => void
  setUsageMs: (value: number) => void
  setLimitMs: (value: number) => void
  setError: (value: string | null) => void
  detectAudioSupport: () => boolean
  setSupportStatus: (status: 'unsupported' | 'supported' | 'unknown') => void
  setMicPermission: (permission: MicPermission) => void
  startSession: StartSession
  endSession: EndSession
  stopMedia: () => void
  onSessionStart: (args: {
    stream: MediaStream
    session: StartSessionResult
  }) => Promise<void>
  onFailure: (
    err: unknown,
    fallback: string,
    source: 'stt' | 'tts' | 'media' | 'network' | 'convex',
  ) => Promise<void>
  sessionIdRef: MutableRefObject<Id<'speakingSessions'> | null>
  stopInProgressRef: MutableRefObject<boolean>
  setStream: (stream: MediaStream | null) => void
}

type StopReason = 'manual' | 'limit' | 'error'

const createDemoId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `demo_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

const resolveDemoId = (fallback?: string) => {
  if (fallback) {
    return fallback
  }

  if (typeof window === 'undefined') {
    return createDemoId()
  }

  const stored = window.localStorage.getItem(DEMO_ID_KEY)
  if (stored) {
    return stored
  }

  const nextId = createDemoId()
  window.localStorage.setItem(DEMO_ID_KEY, nextId)
  return nextId
}

export const useSessionLifecycle = ({
  options,
  status,
  setStatus,
  setMode,
  setSessionId,
  setUsageMs,
  setLimitMs,
  setError,
  detectAudioSupport,
  setSupportStatus,
  setMicPermission,
  startSession,
  endSession,
  stopMedia,
  onSessionStart,
  onFailure,
  sessionIdRef,
  stopInProgressRef,
  setStream,
}: SessionLifecycleParams) => {
  const stop = useCallback(
    async (reason: StopReason = 'manual') => {
      if (stopInProgressRef.current) {
        return
      }

      stopInProgressRef.current = true
      setStatus(
        reason === 'limit'
          ? 'limit_reached'
          : reason === 'error'
            ? 'error'
            : 'ending',
      )

      stopMedia()

      const activeSessionId = sessionIdRef.current
      if (activeSessionId) {
        try {
          const terminationReason: SessionTerminationReason =
            reason === 'limit'
              ? 'limit_reached'
              : reason === 'error'
                ? 'error'
                : 'manual'
          await endSession({
            sessionId: activeSessionId,
            terminationReason,
          })
        } catch (err) {
          console.error('Failed to end session', err)
        }
      }

      sessionIdRef.current = null

      setStatus(
        reason === 'limit'
          ? 'limit_reached'
          : reason === 'error'
            ? 'error'
            : 'idle',
      )
      stopInProgressRef.current = false
    },
    [endSession, setStatus, sessionIdRef, stopInProgressRef, stopMedia],
  )

  const start = useCallback(async () => {
    const supported = detectAudioSupport()
    if (!supported) {
      setSupportStatus('unsupported')
      setMicPermission('unsupported')
      setError('Audio capture is not supported in this browser.')
      setStatus('error')
      return
    }
    setSupportStatus('supported')

    if (status !== 'idle') {
      return
    }

    setError(null)
    setStatus('requesting_mic')

    let stream: MediaStream | null = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options.learnerInputDeviceId
          ? { deviceId: { exact: options.learnerInputDeviceId } }
          : true,
      })
      setStream(stream)
      setMicPermission('granted')
    } catch (err) {
      console.error('Unable to access microphone', err)
      setMicPermission('denied')
      await onFailure(err, 'Microphone access is required to start.', 'media')
      return
    }

    try {
      setStatus('starting')

      const sessionMode = options.mode ?? 'demo'
      const demoId =
        sessionMode === 'demo' ? resolveDemoId(options.demoId) : undefined

      const session = await startSession({
        mode: sessionMode,
        demoId,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage,
        limitMs: options.limitMs,
      })

      sessionIdRef.current = session.sessionId
      setSessionId(session.sessionId)
      setMode(session.mode)
      setLimitMs(session.limitMs)
      setUsageMs(session.usageMs)

      await onSessionStart({ stream, session })
    } catch (err) {
      console.error('Unable to start session', err)
      await onFailure(err, 'Unable to start session.', 'convex')
    }
  }, [
    detectAudioSupport,
    onFailure,
    onSessionStart,
    options.demoId,
    options.limitMs,
    options.mode,
    options.sourceLanguage,
    options.targetLanguage,
    setError,
    setLimitMs,
    setMicPermission,
    setMode,
    setSessionId,
    setStatus,
    setStream,
    setSupportStatus,
    setUsageMs,
    startSession,
    status,
    sessionIdRef,
  ])

  const reset = useCallback(() => {
    setError(null)
    if (status === 'error') {
      setStatus('idle')
    }
  }, [setError, setStatus, status])

  return { start, stop, reset }
}
