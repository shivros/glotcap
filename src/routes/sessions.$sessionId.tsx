import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'

import type { Id } from '../../convex/_generated/dataModel'
import { SessionShell } from '@/components/session-shell'
import { SpeakingSessionHistory } from '@/components/speaking-session-history'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/sessions/$sessionId')({
  component: SessionHistoryRoute,
})

function SessionHistoryRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const params = Route.useParams()

  if (isLoading) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const sessionId = params.sessionId as Id<'speakingSessions'>

  return (
    <SessionShell selectedSessionId={sessionId}>
      <SpeakingSessionHistory sessionId={sessionId} />
    </SessionShell>
  )
}
