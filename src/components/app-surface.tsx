import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AppSurfaceProps = {
  children: ReactNode
  className?: string
}

export function AppSurface({ children, className }: AppSurfaceProps) {
  return (
    <div
      className={cn(
        'relative min-h-screen overflow-hidden bg-[#080c10] text-[color:var(--glotcap-ink)]',
        className,
      )}
    >
      {/* Subtle teal glow top-left — mirrors landing aurora */}
      <div className="pointer-events-none absolute -left-[20%] -top-[30%] h-[80vh] w-[60vw] rounded-full bg-[#1d6c63] opacity-[0.07] blur-[120px]" />
      {/* Subtle coral glow top-right */}
      <div className="pointer-events-none absolute -right-[15%] -top-[20%] h-[60vh] w-[40vw] rounded-full bg-[#f08b5d] opacity-[0.04] blur-[100px]" />
      {children}
    </div>
  )
}

type AppPageContainerProps = {
  children: ReactNode
  className?: string
}

export function AppPageContainer({
  children,
  className,
}: AppPageContainerProps) {
  return (
    <div
      className={cn(
        'relative mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-20 pt-10',
        className,
      )}
    >
      {children}
    </div>
  )
}
