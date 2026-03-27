import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-[color:var(--glotcap-border)] focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:ring-destructive/25 aria-invalid:border-destructive/70 disabled:bg-[color:var(--glotcap-surface-soft)]/70 rounded-xl border bg-[color:var(--glotcap-surface)]/70 px-2.5 py-2 text-base text-[color:var(--glotcap-ink)] transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-[color:var(--glotcap-ink-subtle)]/80 flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
