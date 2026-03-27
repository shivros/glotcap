import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LandingAuthFlow } from '@/components/landing/use-landing-auth-flow'
import { LandingAuthModals } from '@/components/landing/landing-auth-modals'

const renderSpies = vi.hoisted(() => ({
  waitlist: vi.fn(),
  auth: vi.fn(),
}))

vi.mock('@/components/waitlist-dialog', () => ({
  WaitlistDialog: (props: {
    open: boolean
    source?: string
    onOpenChange: (open: boolean) => void
    onHaveCode?: () => void
  }) => {
    renderSpies.waitlist(props)
    return (
      <div data-testid="waitlist-dialog" data-open={String(props.open)}>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          close-waitlist
        </button>
        <button type="button" onClick={() => props.onHaveCode?.()}>
          have-code
        </button>
      </div>
    )
  },
}))

vi.mock('@/components/auth/auth-dialog', () => ({
  AuthDialog: (props: {
    view: string
    defaultInviteCode?: string | null
    onOpenChange: (open: boolean) => void
    onSwitchView: (view: 'login' | 'signup' | 'confirmed') => void
  }) => {
    renderSpies.auth(props)
    return (
      <div data-testid="auth-dialog" data-view={props.view}>
        <div data-testid="auth-invite">{props.defaultInviteCode ?? ''}</div>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          close-auth
        </button>
        <button type="button" onClick={() => props.onSwitchView('login')}>
          switch-auth
        </button>
      </div>
    )
  },
}))

const createFlow = (
  overrides: Partial<LandingAuthFlow> = {},
): LandingAuthFlow => ({
  activeModal: null,
  inviteParam: null,
  isWaitlistOpen: false,
  authView: null,
  openWaitlist: vi.fn(),
  openLogin: vi.fn(),
  openSignup: vi.fn(),
  handleWaitlistOpenChange: vi.fn(),
  handleAuthOpenChange: vi.fn(),
  handleAuthSwitchView: vi.fn(),
  openSignupWithoutInvite: vi.fn(),
  ...overrides,
})

describe('LandingAuthModals', () => {
  beforeEach(() => {
    renderSpies.waitlist.mockClear()
    renderSpies.auth.mockClear()
  })

  it('forwards waitlist state and handlers', () => {
    const flow = createFlow({ isWaitlistOpen: true })
    render(<LandingAuthModals flow={flow} />)

    const waitlist = screen.getByTestId('waitlist-dialog')
    expect(waitlist.getAttribute('data-open')).toBe('true')
    expect(renderSpies.waitlist).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'landing-cinematic',
      }),
    )

    fireEvent.click(screen.getByText('close-waitlist'))
    expect(flow.handleWaitlistOpenChange).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByText('have-code'))
    expect(flow.openSignupWithoutInvite).toHaveBeenCalledTimes(1)
  })

  it('renders auth dialog only when authView is provided', () => {
    const noAuthFlow = createFlow({ authView: null })
    const { rerender } = render(<LandingAuthModals flow={noAuthFlow} />)

    expect(screen.queryByTestId('auth-dialog')).toBeNull()

    const authFlow = createFlow({
      authView: 'signup',
      inviteParam: 'INVITE123',
    })
    rerender(<LandingAuthModals flow={authFlow} />)

    expect(screen.getByTestId('auth-dialog').getAttribute('data-view')).toBe(
      'signup',
    )
    expect(screen.getByTestId('auth-invite').textContent).toBe('INVITE123')
  })

  it('forwards auth dialog callbacks', () => {
    const flow = createFlow({ authView: 'login' })
    render(<LandingAuthModals flow={flow} />)

    fireEvent.click(screen.getByText('close-auth'))
    expect(flow.handleAuthOpenChange).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByText('switch-auth'))
    expect(flow.handleAuthSwitchView).toHaveBeenCalledWith('login')
  })
})
