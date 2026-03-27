import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:ring-destructive/25 aria-invalid:border-destructive/70 rounded-xl border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--glotcap-teal)] text-white shadow-[0_10px_28px_rgba(29,108,99,0.35)] hover:bg-[color:var(--glotcap-sky)] hover:text-[color:var(--glotcap-bg-deep)]',
        outline:
          'border-[color:var(--glotcap-border)] bg-[color:var(--glotcap-surface)]/80 text-[color:var(--glotcap-ink)] hover:border-[color:var(--glotcap-border-strong)] hover:bg-[color:var(--glotcap-surface-soft)] aria-expanded:bg-[color:var(--glotcap-surface-soft)] aria-expanded:text-[color:var(--glotcap-ink)]',
        secondary:
          'bg-[color:var(--glotcap-surface-soft)] text-[color:var(--glotcap-ink)] hover:bg-[color:var(--glotcap-surface)] aria-expanded:bg-[color:var(--glotcap-surface)]',
        ghost:
          'text-[color:var(--glotcap-ink-subtle)] hover:bg-white/8 hover:text-[color:var(--glotcap-ink)] aria-expanded:bg-white/8 aria-expanded:text-[color:var(--glotcap-ink)]',
        destructive:
          'border-[color:var(--glotcap-coral)]/30 bg-[color:var(--glotcap-coral)]/15 text-[color:var(--glotcap-coral)] hover:bg-[color:var(--glotcap-coral)]/24 focus-visible:border-[color:var(--glotcap-coral)]/60',
        link: 'text-[color:var(--glotcap-sky)] underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
