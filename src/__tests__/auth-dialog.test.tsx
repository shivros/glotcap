import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { AuthDialog } from '@/components/auth/auth-dialog'

const mockState = vi.hoisted(() => ({
  signIn: vi.fn(),
  mutation: vi.fn(),
  convexAuth: {
    isAuthenticated: false,
    isLoading: false,
  },
  inviteStatusByCode: {
    ABCDEFGH: { valid: true as const },
  } as Record<string, { valid: boolean; message?: string }>,
}))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({
    signIn: mockState.signIn,
  }),
}))

vi.mock('ts-common/auth/providers/convex/client', () => ({
  useSafeConvexAuthActions: () => ({
    signIn: mockState.signIn,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('convex/react', () => ({
  useMutation: () => mockState.mutation,
  useQuery: (_reference: unknown, args: unknown) => {
    if (args === 'skip') {
      return undefined
    }

    const code = (args as { code?: string }).code
    if (!code) {
      return undefined
    }

    return (
      mockState.inviteStatusByCode[code] ?? {
        valid: false,
        message: 'Invalid sign up code.',
      }
    )
  },
  useConvexAuth: () => mockState.convexAuth,
}))

vi.mock('@/components/ui/app-modal-content', () => ({
  AppModalContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-modal-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog-root">{children}</div> : null,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogMedia: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

function renderAuthDialog(
  view: 'login' | 'signup' | 'confirmed',
  overrides: Partial<{
    open: boolean
    onOpenChange: (open: boolean) => void
    onSwitchView: (view: 'login' | 'signup' | 'confirmed') => void
    onOpenWaitlist: () => void
    defaultInviteCode: string | null
  }> = {},
) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn()
  const onSwitchView = overrides.onSwitchView ?? vi.fn()
  const onOpenWaitlist = overrides.onOpenWaitlist ?? vi.fn()

  render(
    <AuthDialog
      open={overrides.open ?? true}
      view={view}
      onOpenChange={onOpenChange}
      onSwitchView={onSwitchView}
      onOpenWaitlist={onOpenWaitlist}
      defaultInviteCode={overrides.defaultInviteCode}
    />,
  )

  return {
    onOpenChange,
    onSwitchView,
    onOpenWaitlist,
  }
}

describe('AuthDialog', () => {
  beforeEach(() => {
    mockState.signIn.mockReset()
    mockState.mutation.mockReset()
    mockState.convexAuth = {
      isAuthenticated: false,
      isLoading: false,
    }
    mockState.inviteStatusByCode = {
      ABCDEFGH: { valid: true },
    }
  })

  it('submits login credentials and closes when sign-in is completed', async () => {
    mockState.signIn.mockResolvedValue({ signingIn: true })
    const { onOpenChange } = renderAuthDialog('login')

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockState.signIn).toHaveBeenCalledWith(
        'password',
        expect.objectContaining({
          email: 'person@example.com',
          password: 'password123',
          flow: 'signIn',
          redirectTo: '/?auth=confirmed',
        }),
      )
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows confirmation state when login requires email verification', async () => {
    mockState.signIn.mockResolvedValue({ signingIn: false })
    const { onOpenWaitlist } = renderAuthDialog('login')

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'verify@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByText('Check your email')
    expect(screen.getByText(/verify@example.com/i)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Join the wait list' }))
    expect(onOpenWaitlist).toHaveBeenCalledTimes(1)
  })

  it('shows forgot password link and closes when clicked', () => {
    const { onOpenChange } = renderAuthDialog('login')

    fireEvent.click(screen.getByText('Forgot password?'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('validates signup form fields after a valid invite code is entered', async () => {
    renderAuthDialog('signup')

    expect(
      screen.getByText(
        'Enter your 8-character sign up code to unlock registration.',
      ),
    ).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Sign up code'), {
      target: { value: 'ABCDEFGH' },
    })

    await screen.findByRole('button', { name: 'Create account' })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'signup@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'different456' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Passwords do not match')).not.toBeNull()
    expect(mockState.signIn).not.toHaveBeenCalled()
  })

  it('routes confirmed users to login when they are not authenticated yet', () => {
    const { onSwitchView } = renderAuthDialog('confirmed')

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onSwitchView).toHaveBeenCalledWith('login')
  })

  it('shows verification loading state while auth status is resolving', () => {
    mockState.convexAuth = {
      isAuthenticated: false,
      isLoading: true,
    }

    renderAuthDialog('confirmed')

    expect(screen.getByText('Verifying your email...')).not.toBeNull()
  })
})
