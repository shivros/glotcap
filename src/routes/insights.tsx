import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

import { LearningInsightsPage } from '@/components/learning-insights-page'
import { SessionShell } from '@/components/session-shell'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/insights')({
  component: InsightsRoute,
})

function InsightsRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <SessionShell>
      <LearningInsightsPage />
    </SessionShell>
  )
}
