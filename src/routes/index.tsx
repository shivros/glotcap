import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { LandingHome } from '@/components/landing/landing-home'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return <PageSpinner />
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  return <LandingHome />
}
