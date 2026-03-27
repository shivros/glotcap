import type { ReactNode } from 'react'
import { AppPageContainer, AppSurface } from '@/components/app-surface'

type AuthPageShellProps = {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <AppSurface>
      <AppPageContainer className="min-h-screen items-center justify-center">
        <div className="w-full max-w-lg space-y-6">{children}</div>
      </AppPageContainer>
    </AppSurface>
  )
}
