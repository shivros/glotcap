import { useQuery } from 'convex/react'
import { cn } from '../ui'

type AppLogEntry = {
  _id: string
  code?: string
  level?: string
  message: string
  source?: string
  context?: unknown
  entityId?: string
  entityType?: string
  sessionId?: string
  createdAt: number
}

type AppLogsPanelProps = {
  query: any
  limit?: number
  className?: string
  emptyMessage?: string
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString()

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function AppLogsPanel({
  query,
  limit = 60,
  className,
  emptyMessage = 'No logs yet. Trigger an error to see it here.',
}: AppLogsPanelProps) {
  const logs = useQuery(query, { limit }) as Array<AppLogEntry> | undefined

  if (!logs) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading logs...</div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">{emptyMessage}</div>
    )
  }

  return (
    <div
      className={cn(
        'flex max-h-[60vh] flex-col gap-3 overflow-auto p-4 text-sm',
        className,
      )}
    >
      {logs.map((log) => {
        const message = log.message
        const context = log.context ? renderValue(log.context) : ''
        const label = log.code ?? log.level ?? 'log'

        return (
          <details
            key={log._id}
            className="rounded-lg border border-border bg-background/60 p-3"
          >
            <summary className="flex cursor-pointer flex-col gap-1 text-xs">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  {formatTime(log.createdAt)}
                </span>
              </span>
              <span className="text-sm text-foreground">{message}</span>
              <span className="text-[11px] text-muted-foreground">
                {log.source ?? 'unknown'}
              </span>
            </summary>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              {log.entityType ? (
                <div>
                  <span className="font-semibold text-foreground">Type:</span>{' '}
                  {log.entityType}
                </div>
              ) : null}
              {log.entityId ? (
                <div className="break-all">
                  <span className="font-semibold text-foreground">Entity:</span>{' '}
                  {log.entityId}
                </div>
              ) : null}
              {log.sessionId ? (
                <div className="break-all">
                  <span className="font-semibold text-foreground">
                    Session:
                  </span>{' '}
                  {log.sessionId}
                </div>
              ) : null}
              {context ? (
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
                  {context}
                </pre>
              ) : null}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export default AppLogsPanel
