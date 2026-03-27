import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-4',
}

type SpinnerSize = keyof typeof sizeClasses

type SpinnerProps = {
  size?: SpinnerSize
  className?: string
  label?: string
}

export function Spinner({
  size = 'lg',
  className,
  label = 'Loading',
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-primary border-t-transparent',
        sizeClasses[size],
        className,
      )}
    />
  )
}

type PageSpinnerProps = SpinnerProps & {
  containerClassName?: string
}

export function PageSpinner({
  containerClassName,
  ...spinnerProps
}: PageSpinnerProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center',
        containerClassName,
      )}
    >
      <Spinner {...spinnerProps} />
    </div>
  )
}
