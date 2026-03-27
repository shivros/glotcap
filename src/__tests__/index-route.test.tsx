import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { Route } from '@/routes/index'

const authState = vi.hoisted(() => ({
  value: {
    isAuthenticated: false,
    isLoading: false,
  },
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => authState.value,
}))

vi.mock('@/components/landing/landing-home', () => ({
  LandingHome: () => <div data-testid="landing-home">landing-home</div>,
}))

vi.mock('@/components/ui/spinner', () => ({
  PageSpinner: () => <div data-testid="page-spinner">page-spinner</div>,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
      <div
        data-testid="navigate"
        data-to={to}
        data-replace={String(Boolean(replace))}
      >
        navigate
      </div>
    ),
  }
})

const RouteComponent = Route.options.component as ComponentType

describe('routes/index', () => {
  beforeEach(() => {
    authState.value = {
      isAuthenticated: false,
      isLoading: false,
    }
  })

  it('shows spinner while auth state is loading', () => {
    authState.value = {
      isAuthenticated: false,
      isLoading: true,
    }

    render(<RouteComponent />)

    expect(screen.getByTestId('page-spinner')).not.toBeNull()
    expect(screen.queryByTestId('landing-home')).toBeNull()
    expect(screen.queryByTestId('navigate')).toBeNull()
  })

  it('redirects authenticated users to /app', () => {
    authState.value = {
      isAuthenticated: true,
      isLoading: false,
    }

    render(<RouteComponent />)

    const navigate = screen.getByTestId('navigate')
    expect(navigate.getAttribute('data-to')).toBe('/app')
    expect(navigate.getAttribute('data-replace')).toBe('true')
    expect(screen.queryByTestId('landing-home')).toBeNull()
  })

  it('renders landing for unauthenticated users', () => {
    authState.value = {
      isAuthenticated: false,
      isLoading: false,
    }

    render(<RouteComponent />)

    expect(screen.getByTestId('landing-home')).not.toBeNull()
    expect(screen.queryByTestId('navigate')).toBeNull()
  })
})
