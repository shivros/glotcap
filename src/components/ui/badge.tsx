import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px] aria-invalid:ring-destructive/25 aria-invalid:border-destructive transition-colors overflow-hidden group/badge',
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--glotcap-teal)]/18 text-[color:var(--glotcap-sky)] [a]:hover:bg-[color:var(--glotcap-teal)]/30',
        secondary:
          'bg-[color:var(--glotcap-surface-soft)] text-[color:var(--glotcap-ink)] [a]:hover:bg-[color:var(--glotcap-surface)]',
        destructive:
          'bg-[color:var(--glotcap-coral)]/16 [a]:hover:bg-[color:var(--glotcap-coral)]/24 focus-visible:ring-[color:var(--glotcap-coral)]/30 text-[color:var(--glotcap-coral)]',
        outline:
          'border-[color:var(--glotcap-border)] text-[color:var(--glotcap-ink)] [a]:hover:bg-white/6 [a]:hover:text-[color:var(--glotcap-ink)]',
        ghost: 'hover:bg-white/8 hover:text-[color:var(--glotcap-ink)]',
        link: 'text-[color:var(--glotcap-sky)] underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ className, variant })),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
