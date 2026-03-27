import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useActionMock = vi.fn()

vi.mock('convex/react', () => ({
  useAction: (...args: Array<unknown>) => useActionMock(...args),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => <>{children}</>,
  Outlet: () => null,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/account' }),
  createFileRoute: () => () => ({
    useSearch: () => ({}),
  }),
}))

describe('GlotCap PasswordChangeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state when canChangePassword is undefined', async () => {
    useActionMock.mockImplementation(() => vi.fn())
    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={undefined} />)
    expect(screen.getByText('Loading security settings...')).toBeTruthy()
  })

  it('shows OAuth-only message when canChangePassword is false', async () => {
    useActionMock.mockImplementation(() => vi.fn())
    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={false} />)
    expect(
      screen.getByText(
        'Password change is available only for email/password accounts.',
      ),
    ).toBeTruthy()
  })

  it('renders password change form when canChangePassword is true', async () => {
    useActionMock.mockImplementation(() => vi.fn())
    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={true} />)
    expect(screen.getByLabelText('Current password')).toBeTruthy()
    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm new password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeTruthy()
  })

  it('submits password change and shows success', async () => {
    const changePasswordMock = vi.fn(() =>
      Promise.resolve({ status: 'password_changed' }),
    )
    useActionMock.mockImplementation(() => changePasswordMock)

    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={true} />)

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-pass' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: 'old-pass',
        newPassword: 'new-pass-123',
        confirmPassword: 'new-pass-123',
      })
    })
    expect(
      screen.getByText(
        'Password updated successfully. Other sessions have been signed out.',
      ),
    ).toBeTruthy()
  })

  it('shows client-side mismatch error without calling server', async () => {
    const changePasswordMock = vi.fn()
    useActionMock.mockImplementation(() => changePasswordMock)

    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={true} />)

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-pass' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(
        screen.getByText('New password and confirmation do not match.'),
      ).toBeTruthy()
    })
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('shows error when server request fails', async () => {
    const changePasswordMock = vi.fn(() =>
      Promise.reject(new Error('Server error')),
    )
    useActionMock.mockImplementation(() => changePasswordMock)

    const module = await import('@/routes/account')
    render(<module.PasswordChangeSection canChangePassword={true} />)

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-pass' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-pass-123' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy()
    })
  })
})
