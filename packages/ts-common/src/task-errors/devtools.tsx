import { useQuery } from 'convex/react'
import { cn } from '../ui'

type TaskErrorEntry = {
  _id: string
  task_id: string
  user_id: string
  error_message: string
  error_detail?: string
  created_at: number
}

type TaskErrorsPanelProps = {
  query: any
  limit?: number
  className?: string
  emptyMessage?: string
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString()

const renderDetail = (detail?: string) => {
  if (!detail) return ''

  try {
    const parsed = JSON.parse(detail)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return detail
  }
}

export function TaskErrorsPanel({
  query,
  limit = 50,
  className,
  emptyMessage = 'No task errors yet. Trigger a failure to see it here.',
}: TaskErrorsPanelProps) {
  const errors = useQuery(query, { limit }) as Array<TaskErrorEntry> | undefined

  if (!errors) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading task errors...
      </div>
    )
  }

  if (errors.length === 0) {
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
      {errors.map((error) => {
        const detail = renderDetail(error.error_detail)

        return (
          <details
            key={error._id}
            className="rounded-lg border border-border bg-background/60 p-3"
          >
            <summary className="flex cursor-pointer flex-col gap-1 text-xs">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  Task Error
                </span>
                <span className="text-muted-foreground">
                  {formatTime(error.created_at)}
                </span>
              </span>
              <span className="text-sm text-foreground">
                {error.error_message}
              </span>
            </summary>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <div className="break-all">
                <span className="font-semibold text-foreground">Task:</span>{' '}
                {error.task_id}
              </div>
              <div className="break-all">
                <span className="font-semibold text-foreground">User:</span>{' '}
                {error.user_id}
              </div>
              {detail ? (
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
                  {detail}
                </pre>
              ) : null}
            </div>
          </details>
        )
      })}
    </div>
  )
}

export default TaskErrorsPanel
