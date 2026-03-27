import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useActionMock = vi.fn()
const useNavigateMock = vi.fn()

vi.mock('convex/react', () => ({
  useAction: (...args: Array<unknown>) => useActionMock(...args),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => <>{children}</>,
  useNavigate: () => useNavigateMock,
  createFileRoute: () => () => ({
    useSearch: () => ({ token: 'token' }),
  }),
}))

describe('VerifyEmailChangeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows invalid token message when token missing', async () => {
    useActionMock.mockReturnValue(vi.fn())
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangeView token="" />)

    await waitFor(() => {
      expect(screen.getByText('Missing verification token.')).toBeTruthy()
    })
  })

  it('shows verified message', async () => {
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'verified' })),
    )
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangeView token="abc" />)

    await waitFor(() => {
      expect(
        screen.getByText('Your email has been updated successfully.'),
      ).toBeTruthy()
    })
  })

  it('redirects to account after verified delay', async () => {
    vi.useFakeTimers()
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'verified' })),
    )
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangeView token="abc" />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(
      screen.getByText('Your email has been updated successfully.'),
    ).toBeTruthy()

    expect(useNavigateMock).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(useNavigateMock).toHaveBeenCalledWith({
      to: '/account',
      search: { emailChange: 'verified' },
    })
    vi.useRealTimers()
  })

  it('maps expired status message', async () => {
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'expired' })),
    )
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangeView token="abc" />)

    await waitFor(() => {
      expect(
        screen.getByText('This verification link has expired.'),
      ).toBeTruthy()
    })
  })

  it('maps already used and email taken statuses', async () => {
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'already_used' })),
    )
    const module = await import('@/routes/account.email-change.verify')
    const { rerender } = render(<module.VerifyEmailChangeView token="abc" />)

    await waitFor(() => {
      expect(
        screen.getByText('This verification link has already been used.'),
      ).toBeTruthy()
    })

    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'email_taken' })),
    )
    rerender(<module.VerifyEmailChangeView token="abc" />)
    await waitFor(() => {
      expect(
        screen.getByText('That email is already in use by another account.'),
      ).toBeTruthy()
    })
  })

  it('shows action error message on thrown error', async () => {
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.reject(new Error('Network failed'))),
    )
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangeView token="abc" />)

    await waitFor(() => {
      expect(screen.getByText('Network failed')).toBeTruthy()
    })
  })

  it('reads token from route search in page wrapper', async () => {
    const verifyMock = vi.fn(() => Promise.resolve({ status: 'invalid_token' }))
    useActionMock.mockReturnValue(verifyMock)
    const module = await import('@/routes/account.email-change.verify')
    render(<module.VerifyEmailChangePage />)

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledWith({ token: 'token' })
    })
  })

  it('clears redirect timer on unmount', async () => {
    vi.useFakeTimers()
    useActionMock.mockReturnValue(
      vi.fn(() => Promise.resolve({ status: 'verified' })),
    )
    const module = await import('@/routes/account.email-change.verify')
    const rendered = render(<module.VerifyEmailChangeView token="abc" />)
    await act(async () => {
      await Promise.resolve()
    })
    rendered.unmount()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(useNavigateMock).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('resolveVerifyPresentation', () => {
  it('falls back unknown status to invalid token presentation', async () => {
    const module = await import('@/routes/account.email-change.verify')
    expect(module.resolveVerifyPresentation('something_unexpected')).toEqual({
      status: 'invalid_token',
      message: 'This verification link is invalid.',
      redirectOnSuccess: false,
    })
  })
})
