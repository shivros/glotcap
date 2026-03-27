import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  search: { token: 'token_abc' },
  action: vi.fn(),
  usePasswordResetRequest: vi.fn(),
  usePasswordResetForm: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mockState.search,
  }),
}))

vi.mock('convex/react', () => ({
  useAction: () => mockState.action,
}))

vi.mock('ts-common/convex/password-reset-hooks', () => ({
  usePasswordResetRequest: (...args: Array<unknown>) =>
    mockState.usePasswordResetRequest(...args),
  usePasswordResetForm: (...args: Array<unknown>) =>
    mockState.usePasswordResetForm(...args),
}))

describe('forgot-password route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.usePasswordResetRequest.mockReturnValue({
      email: 'person@example.com',
      setEmail: vi.fn(),
      isSubmitting: false,
      error: null,
      success: false,
      submit: vi.fn(),
    })
  })

  it('renders forgot password form', async () => {
    const module = await import('@/routes/forgot-password')
    render(<module.ForgotPasswordPage />)

    expect(screen.getByText('Forgot your password?')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeTruthy()
  })

  it('renders success state when reset email was requested', async () => {
    mockState.usePasswordResetRequest.mockReturnValue({
      email: 'person@example.com',
      setEmail: vi.fn(),
      isSubmitting: false,
      error: null,
      success: true,
      submit: vi.fn(),
    })
    const module = await import('@/routes/forgot-password')
    render(<module.ForgotPasswordPage />)

    expect(screen.getByText('Check your email')).toBeTruthy()
    expect(screen.getByText(/we sent a password reset link/i)).toBeTruthy()
  })

  it('wires requestReset callback to action and maps request scope errors', async () => {
    mockState.action.mockResolvedValue({ status: 'reset_email_sent' })
    const module = await import('@/routes/forgot-password')
    render(<module.ForgotPasswordPage />)

    const options = mockState.usePasswordResetRequest.mock.calls[0]?.[0] as {
      requestReset: (email: string) => Promise<unknown>
      mapErrorMessage: (error: unknown) => string
    }
    await options.requestReset('hook@example.com')

    expect(mockState.action).toHaveBeenCalledWith({ email: 'hook@example.com' })
    expect(
      options.mapErrorMessage(
        new Error(
          '[CONVEX A(passwordReset:requestPasswordReset)] [Request ID: abc] Server Error Called by client',
        ),
      ),
    ).toBe('Unable to send reset email.')
  })

  it('handles input change and submit events', async () => {
    const setEmail = vi.fn()
    const submit = vi.fn()
    mockState.usePasswordResetRequest.mockReturnValue({
      email: 'person@example.com',
      setEmail,
      isSubmitting: false,
      error: null,
      success: false,
      submit,
    })
    const module = await import('@/routes/forgot-password')
    const rendered = render(<module.ForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'changed@example.com' },
    })
    fireEvent.submit(
      rendered.container.querySelector('form') as HTMLFormElement,
    )

    expect(setEmail).toHaveBeenCalledWith('changed@example.com')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('renders submitting and error states', async () => {
    mockState.usePasswordResetRequest.mockReturnValue({
      email: 'person@example.com',
      setEmail: vi.fn(),
      isSubmitting: true,
      error: 'Rate limited.',
      success: false,
      submit: vi.fn(),
    })
    const module = await import('@/routes/forgot-password')
    render(<module.ForgotPasswordPage />)

    expect(screen.getByText('Rate limited.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeTruthy()
  })
})

describe('reset-password route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.search = { token: 'token_abc' }
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: '',
      confirmPassword: '',
      setNewPassword: vi.fn(),
      setConfirmPassword: vi.fn(),
      isSubmitting: false,
      error: null,
      result: { status: 'idle' },
      submit: vi.fn(),
    })
  })

  it('renders invalid token state when token is missing', async () => {
    mockState.search = { token: '' }
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Invalid reset link')).toBeTruthy()
    expect(screen.getByText(/please request a new one/i)).toBeTruthy()
  })

  it('normalizes token from validateSearch', async () => {
    const module = await import('@/routes/reset-password')
    expect(module.normalizeResetPasswordSearch({ token: 'abc' })).toEqual({
      token: 'abc',
    })
    expect(module.normalizeResetPasswordSearch({})).toEqual({
      token: '',
    })
  })

  it('renders reset form when token is present and result is idle', async () => {
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Reset your password')).toBeTruthy()
    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeTruthy()
  })

  it('wires resetPassword callback to action and maps submit scope errors', async () => {
    mockState.action.mockResolvedValue({ status: 'password_reset' })
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    const options = mockState.usePasswordResetForm.mock.calls[0]?.[0] as {
      resetPassword: (params: {
        token: string
        newPassword: string
        confirmPassword: string
      }) => Promise<unknown>
      mapErrorMessage: (error: unknown) => string
    }

    await options.resetPassword({
      token: 'token_abc',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    })

    expect(mockState.action).toHaveBeenCalledWith({
      token: 'token_abc',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    })
    expect(
      options.mapErrorMessage(
        new Error(
          '[CONVEX A(passwordReset:resetPassword)] [Request ID: abc] Server Error Called by client',
        ),
      ),
    ).toBe('Unable to reset your password.')
  })

  it('handles reset form input changes and submit events', async () => {
    const setNewPassword = vi.fn()
    const setConfirmPassword = vi.fn()
    const submit = vi.fn()
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: '',
      confirmPassword: '',
      setNewPassword,
      setConfirmPassword,
      isSubmitting: false,
      error: null,
      result: { status: 'idle' },
      submit,
    })
    const module = await import('@/routes/reset-password')
    const rendered = render(<module.ResetPasswordPage />)

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password-123' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'new-password-123' },
    })
    fireEvent.submit(
      rendered.container.querySelector('form') as HTMLFormElement,
    )

    expect(setNewPassword).toHaveBeenCalledWith('new-password-123')
    expect(setConfirmPassword).toHaveBeenCalledWith('new-password-123')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('renders reset form error and submitting states', async () => {
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: 'x',
      confirmPassword: 'x',
      setNewPassword: vi.fn(),
      setConfirmPassword: vi.fn(),
      isSubmitting: true,
      error: 'Password policy violation.',
      result: { status: 'idle' },
      submit: vi.fn(),
    })
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Password policy violation.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resetting...' })).toBeTruthy()
  })

  it('renders already used state', async () => {
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: '',
      confirmPassword: '',
      setNewPassword: vi.fn(),
      setConfirmPassword: vi.fn(),
      isSubmitting: false,
      error: null,
      result: { status: 'already_used' },
      submit: vi.fn(),
    })
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Link already used')).toBeTruthy()
    expect(screen.getByText(/has already been used/i)).toBeTruthy()
  })

  it('renders password reset success state', async () => {
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: '',
      confirmPassword: '',
      setNewPassword: vi.fn(),
      setConfirmPassword: vi.fn(),
      isSubmitting: false,
      error: null,
      result: { status: 'password_reset' },
      submit: vi.fn(),
    })
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Password reset')).toBeTruthy()
    expect(screen.getByText(/has been reset successfully/i)).toBeTruthy()
  })

  it('falls back to invalid link presentation for unknown status', async () => {
    mockState.usePasswordResetForm.mockReturnValue({
      newPassword: '',
      confirmPassword: '',
      setNewPassword: vi.fn(),
      setConfirmPassword: vi.fn(),
      isSubmitting: false,
      error: null,
      result: { status: 'unexpected_status' } as any,
      submit: vi.fn(),
    })
    const module = await import('@/routes/reset-password')
    render(<module.ResetPasswordPage />)

    expect(screen.getByText('Invalid reset link')).toBeTruthy()
    expect(
      screen.getByText(
        /this password reset link is invalid\. please request a new one\./i,
      ),
    ).toBeTruthy()
  })
})

describe('resolveResetPresentation', () => {
  it('falls back unknown status to invalid-token presentation', async () => {
    const module = await import('@/routes/reset-password')
    expect(module.resolveResetPresentation('something_else')).toEqual({
      title: 'Invalid reset link',
      message: 'This password reset link is invalid. Please request a new one.',
      variant: 'error',
    })
  })
})
