import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/tools')({
  component: ToolsRoute,
})

function ToolsRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
