import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Menu, Plus, X } from 'lucide-react'
import { DEFAULT_AUTH_DAILY_LIMIT_MS } from 'ts-common/speech/limits'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/speaking-coach-utils'
import {
  APP_DRAWER_SURFACE_CLASS,
  APP_INPUT_SURFACE_CLASS,
  APP_OVERLAY_CLASS,
  APP_PANEL_SOFT_CLASS,
  APP_TEXT_LABEL_STRONG_CLASS,
  APP_TEXT_SUBTLE_CLASS,
} from '@/theme/semantic'

const sessionStatusLabels: Record<string, string> = {
  limit_reached: 'Limit reached',
  ended: 'Ended',
  active: 'Active',
}

const formatSessionTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

type SessionDrawerProps = {
  sessions: Array<{
    _id: Id<'speakingSessions'>
    createdAt: number
    targetLanguage: string
    status: string
  }>
  selectedSessionId?: Id<'speakingSessions'> | null
  getUsageMs: (sessionId: Id<'speakingSessions'>) => number
  dailyUsedMs: number
  dailyLimitMs: number
  dailyRemainingMs: number
  dailyProgressPct: number
  isLimitReached: boolean
  isOpen: boolean
  onClose: () => void
  onSelectSession: (sessionId: Id<'speakingSessions'>) => void
  onNewSession: () => void
}

const SessionDrawer = ({
  sessions,
  selectedSessionId,
  getUsageMs,
  dailyUsedMs,
  dailyLimitMs,
  dailyRemainingMs,
  dailyProgressPct,
  isLimitReached,
  isOpen,
  onClose,
  onSelectSession,
  onNewSession,
}: SessionDrawerProps) => (
  <aside
    className={cn(
      `fixed inset-y-0 left-0 z-40 w-72 -translate-x-full transition-transform lg:static lg:h-full lg:translate-x-0 ${APP_DRAWER_SURFACE_CLASS}`,
      isOpen && 'translate-x-0',
    )}
  >
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
        <div>
          <p className="text-sm font-semibold">GlotCap</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Close sessions"
            title="Close sessions"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="border-b border-white/5 px-4 py-3">
        <div
          className={cn(
            'flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em]',
            APP_TEXT_LABEL_STRONG_CLASS,
          )}
        >
          <span>Usage</span>
          <span>
            {formatDuration(dailyUsedMs)} / {formatDuration(dailyLimitMs)}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted/30">
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${dailyProgressPct}%` }}
          />
        </div>
        <p
          className={cn(
            'mt-1 text-[11px]',
            isLimitReached ? 'text-destructive' : APP_TEXT_SUBTLE_CLASS,
          )}
        >
          {isLimitReached
            ? 'Daily limit reached.'
            : `${formatDuration(dailyRemainingMs)} left today`}
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        <p
          className={cn(
            'text-[11px] font-semibold uppercase tracking-[0.3em]',
            APP_TEXT_LABEL_STRONG_CLASS,
          )}
        >
          Sessions
        </p>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 text-left text-sm font-semibold',
            APP_INPUT_SURFACE_CLASS,
          )}
          onClick={onNewSession}
        >
          <Plus className="size-4" />
          New session
        </Button>
        {sessions.length === 0 ? (
          <p className={cn('text-sm', APP_TEXT_SUBTLE_CLASS)}>
            No sessions yet.
          </p>
        ) : (
          sessions.map((entry) => {
            const isSelected = entry._id === selectedSessionId
            const usageMs = getUsageMs(entry._id)
            return (
              <button
                key={entry._id}
                type="button"
                onClick={() => onSelectSession(entry._id)}
                className={cn(
                  'w-full rounded-2xl border px-3 py-3 text-left transition',
                  isSelected
                    ? 'border-primary/60 bg-primary/10'
                    : `${APP_PANEL_SOFT_CLASS} hover:border-input/80`,
                )}
              >
                <p
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.2em]',
                    APP_TEXT_LABEL_STRONG_CLASS,
                  )}
                >
                  {formatSessionTimestamp(entry.createdAt)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {entry.targetLanguage}
                  </p>
                  <span className={cn('text-xs', APP_TEXT_SUBTLE_CLASS)}>
                    {formatDuration(usageMs)}
                  </span>
                </div>
                <p className={cn('text-xs', APP_TEXT_LABEL_STRONG_CLASS)}>
                  {sessionStatusLabels[entry.status] ?? 'Session'}
                </p>
              </button>
            )
          })
        )}
      </div>
    </div>
  </aside>
)

type SessionShellProps = {
  selectedSessionId?: Id<'speakingSessions'> | null
  children: React.ReactNode
}

export const useSessionDrawer = () => {
  const [isOpen, setIsOpen] = useState(false)
  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => setIsOpen(false), [])
  return { isOpen, openDrawer, closeDrawer, setIsOpen }
}

export const SessionShell = ({
  selectedSessionId,
  children,
}: SessionShellProps) => {
  const navigate = useNavigate()
  const { isOpen, openDrawer, closeDrawer, setIsOpen } = useSessionDrawer()

  const sessions =
    useQuery(api.speaking.listRecentSessions, { limit: 30 }) ?? []
  const sessionIds = useMemo(
    () => sessions.map((entry) => entry._id),
    [sessions],
  )
  const sessionUsageMap = useQuery(
    api.speaking.getSessionUsageBatch,
    sessionIds.length > 0 ? { sessionIds } : 'skip',
  )
  const dailyUsage = useQuery(api.speaking.getDailyUsage)
  const dailyLimitMs = dailyUsage?.limitMs ?? DEFAULT_AUTH_DAILY_LIMIT_MS
  const dailyUsedMs = dailyUsage?.totalMs ?? 0
  const dailyRemainingMs =
    dailyUsage?.remainingMs ?? Math.max(dailyLimitMs - dailyUsedMs, 0)
  const dailyProgressPct = dailyLimitMs
    ? Math.min((dailyUsedMs / dailyLimitMs) * 100, 100)
    : 0
  const isLimitReached = dailyUsage ? dailyUsage.remainingMs <= 0 : false

  const handleSelectSession = useCallback(
    (sessionId: Id<'speakingSessions'>) => {
      setIsOpen(false)
      navigate({
        to: '/sessions/$sessionId',
        params: { sessionId },
      })
    },
    [navigate, setIsOpen],
  )

  const handleNewSession = useCallback(() => {
    setIsOpen(false)
    navigate({ to: '/app' })
  }, [navigate, setIsOpen])

  const getUsageMs = useCallback(
    (sessionId: Id<'speakingSessions'>) =>
      sessionUsageMap?.[sessionId]?.usageMs ?? 0,
    [sessionUsageMap],
  )

  return (
    <div className="relative h-screen overflow-hidden">
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sessions"
          className={cn('fixed inset-0 z-30 lg:hidden', APP_OVERLAY_CLASS)}
          onClick={closeDrawer}
        />
      ) : null}
      <div className="flex h-full">
        <SessionDrawer
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          getUsageMs={getUsageMs}
          dailyUsedMs={dailyUsedMs}
          dailyLimitMs={dailyLimitMs}
          dailyRemainingMs={dailyRemainingMs}
          dailyProgressPct={dailyProgressPct}
          isLimitReached={isLimitReached}
          isOpen={isOpen}
          onClose={closeDrawer}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="m-4"
              aria-label="Open sessions"
              title="Open sessions"
              onClick={openDrawer}
            >
              <Menu className="size-4" />
            </Button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
