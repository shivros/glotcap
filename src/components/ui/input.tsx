import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'border-[color:var(--glotcap-border)] focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:ring-destructive/25 aria-invalid:border-destructive/70 disabled:bg-[color:var(--glotcap-surface-soft)]/70 h-8 rounded-xl border bg-[color:var(--glotcap-surface)]/70 px-2.5 py-1 text-base text-[color:var(--glotcap-ink)] transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm file:text-[color:var(--glotcap-ink)] placeholder:text-[color:var(--glotcap-ink-subtle)]/80 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
