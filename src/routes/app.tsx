import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

import { SpeakingCoachApp } from '@/components/speaking-coach-app'
import { SessionShell } from '@/components/session-shell'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/app')({
  component: AppRoute,
})

function AppRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <SessionShell>
      <SpeakingCoachApp />
    </SessionShell>
  )
}
