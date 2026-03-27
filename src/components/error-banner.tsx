import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorBannerProps = {
  message: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function ErrorBanner({
  message,
  actionLabel = 'Dismiss',
  onAction,
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-card/90 p-4 text-sm text-foreground',
        className,
      )}
      role="alert"
    >
      <span>{message}</span>
      {onAction ? (
        <Button
          size="sm"
          variant="outline"
          className="bg-card/90"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
