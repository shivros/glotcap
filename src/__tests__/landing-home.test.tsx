import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingHome } from '@/components/landing/landing-home'

vi.mock('@/components/landing/landing-cinematic', () => ({
  LandingCinematic: (props: {
    onSignIn?: () => void
    onStartFree?: () => void
    demoHref?: string
  }) => (
    <div>
      <button type="button" onClick={props.onSignIn}>
        sign-in
      </button>
      <button type="button" onClick={props.onStartFree}>
        start-free
      </button>
      {props.demoHref ? (
        <a href={props.demoHref} data-testid="demo-link">
          live-demo
        </a>
      ) : null}
    </div>
  ),
}))

vi.mock('@/components/landing/landing-auth-modals', () => ({
  LandingAuthModals: ({ flow }: { flow: any }) => (
    <div>
      <div data-testid="active-modal">{String(flow.activeModal)}</div>
      <div data-testid="invite-param">{flow.inviteParam ?? ''}</div>
    </div>
  ),
}))

const setSearch = (search: string) => {
  const suffix = search ? `/?${search}` : '/'
  window.history.replaceState({}, '', suffix)
}

describe('LandingHome', () => {
  beforeEach(() => {
    setSearch('')
  })

  it('wires cinematic CTA actions into auth flow transitions', async () => {
    render(<LandingHome />)

    expect(screen.getByTestId('active-modal').textContent).toBe('null')

    fireEvent.click(screen.getByText('sign-in'))
    await waitFor(() =>
      expect(screen.getByTestId('active-modal').textContent).toBe('login'),
    )

    fireEvent.click(screen.getByText('start-free'))
    await waitFor(() =>
      expect(screen.getByTestId('active-modal').textContent).toBe('waitlist'),
    )

    const demoLink = screen.getByTestId('demo-link')
    expect(demoLink).toBeInstanceOf(HTMLAnchorElement)
    expect((demoLink as HTMLAnchorElement).getAttribute('href')).toBe('/demo')
  })

  it('hydrates signup state from invite query params', async () => {
    setSearch('invite=QWER5678')
    render(<LandingHome />)

    await waitFor(() =>
      expect(screen.getByTestId('active-modal').textContent).toBe('signup'),
    )
    expect(screen.getByTestId('invite-param').textContent).toBe('QWER5678')
  })

  it('hydrates confirmed state from auth query params', async () => {
    setSearch('auth=confirmed')
    render(<LandingHome />)

    await waitFor(() =>
      expect(screen.getByTestId('active-modal').textContent).toBe('confirmed'),
    )
  })
})
