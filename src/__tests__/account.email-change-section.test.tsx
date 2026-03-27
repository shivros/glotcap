import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useActionMock = vi.fn()
const useMutationMock = vi.fn()

vi.mock('convex/react', () => ({
  useAction: (...args: Array<unknown>) => useActionMock(...args),
  useMutation: (...args: Array<unknown>) => useMutationMock(...args),
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => <>{children}</>,
  useNavigate: () => vi.fn(),
  createFileRoute: () => () => ({
    useSearch: () => ({}),
  }),
}))

describe('GlotCap EmailChangeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests email change and shows success message', async () => {
    const requestMock = vi.fn(() =>
      Promise.resolve({ newEmail: 'new@example.com' }),
    )
    const resendMock = vi.fn(() =>
      Promise.resolve({ newEmail: 'new@example.com' }),
    )
    const cancelMock = vi.fn(() => Promise.resolve({ cancelledCount: 1 }))
    let actionHookCall = 0
    useActionMock.mockImplementation(() => {
      actionHookCall += 1
      return actionHookCall % 2 === 1 ? requestMock : resendMock
    })
    useMutationMock.mockImplementation(() => cancelMock)

    const module = await import('@/routes/account')
    render(
      <module.EmailChangeSection
        currentEmail="old@example.com"
        pendingChange={null}
      />,
    )

    fireEvent.change(screen.getByLabelText('New email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send verification email' }),
    )

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith({ newEmail: 'new@example.com' })
    })
    expect(
      screen.getByText('Verification email sent to new@example.com.'),
    ).toBeTruthy()
  })

  it('shows error when request fails', async () => {
    const requestMock = vi.fn(() => Promise.reject(new Error('Bad request')))
    let actionHookCall = 0
    useActionMock.mockImplementation(() => {
      actionHookCall += 1
      return actionHookCall % 2 === 1 ? requestMock : vi.fn()
    })
    useMutationMock.mockImplementation(() => vi.fn())

    const module = await import('@/routes/account')
    render(
      <module.EmailChangeSection
        currentEmail="old@example.com"
        pendingChange={null}
      />,
    )

    fireEvent.change(screen.getByLabelText('New email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send verification email' }),
    )

    await waitFor(() => {
      expect(screen.getByText('Bad request')).toBeTruthy()
    })
  })

  it('resends and cancels pending change', async () => {
    const requestMock = vi.fn(() =>
      Promise.resolve({ newEmail: 'new@example.com' }),
    )
    const resendMock = vi.fn(() =>
      Promise.resolve({ newEmail: 'new@example.com' }),
    )
    const cancelMock = vi.fn(() => Promise.resolve({ cancelledCount: 1 }))
    let actionHookCall = 0
    useActionMock.mockImplementation(() => {
      actionHookCall += 1
      return actionHookCall % 2 === 1 ? requestMock : resendMock
    })
    useMutationMock.mockImplementation(() => cancelMock)

    const module = await import('@/routes/account')
    render(
      <module.EmailChangeSection
        currentEmail="old@example.com"
        pendingChange={{
          newEmail: 'new@example.com',
          expiresAt: Date.now() + 100_000,
          requestedAt: Date.now(),
          resendCount: 0,
          isExpired: false,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resend verification' }))
    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledWith({})
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith({})
    })
  })

  it('shows resend and cancel errors', async () => {
    const requestMock = vi.fn(() =>
      Promise.resolve({ newEmail: 'new@example.com' }),
    )
    const resendMock = vi.fn(() => Promise.reject(new Error('Resend failed')))
    const cancelMock = vi.fn(() => Promise.reject(new Error('Cancel failed')))
    let actionHookCall = 0
    useActionMock.mockImplementation(() => {
      actionHookCall += 1
      return actionHookCall % 2 === 1 ? requestMock : resendMock
    })
    useMutationMock.mockImplementation(() => cancelMock)

    const module = await import('@/routes/account')
    render(
      <module.EmailChangeSection
        currentEmail="old@example.com"
        pendingChange={{
          newEmail: 'new@example.com',
          expiresAt: Date.now() + 100_000,
          requestedAt: Date.now(),
          resendCount: 0,
          isExpired: false,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resend verification' }))
    await waitFor(() => {
      expect(screen.getByText('Resend failed')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.getByText('Cancel failed')).toBeTruthy()
    })
  })

  it('disables resend when pending change is expired', async () => {
    useActionMock.mockImplementation(() => vi.fn())
    useMutationMock.mockImplementation(() => vi.fn())
    const module = await import('@/routes/account')
    render(
      <module.EmailChangeSection
        currentEmail="old@example.com"
        pendingChange={{
          newEmail: 'new@example.com',
          expiresAt: Date.now() - 1000,
          requestedAt: Date.now() - 2000,
          resendCount: 0,
          isExpired: true,
        }}
      />,
    )
    expect(
      screen
        .getByRole('button', { name: 'Resend verification' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})
