import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { WaitlistDialog } from '@/components/waitlist-dialog'

const mockState = vi.hoisted(() => ({
  joinWaitlist: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: () => mockState.joinWaitlist,
}))

vi.mock('@/components/ui/app-modal-content', () => ({
  AppModalContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-modal-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
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

describe('WaitlistDialog', () => {
  beforeEach(() => {
    mockState.joinWaitlist.mockReset()
  })

  it('validates email input before submitting', () => {
    render(<WaitlistDialog open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'not-an-email' },
    })

    const form = screen
      .getByRole('button', { name: 'Join the wait list' })
      .closest('form')
    if (!form) {
      throw new Error('Expected waitlist form to be present')
    }
    fireEvent.submit(form)

    expect(screen.getByText('Enter a valid email address.')).not.toBeNull()
    expect(mockState.joinWaitlist).not.toHaveBeenCalled()
  })

  it('submits normalized email and displays success copy', async () => {
    mockState.joinWaitlist.mockResolvedValue(undefined)

    render(
      <WaitlistDialog open source="landing-cinematic" onOpenChange={vi.fn()} />,
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: '  Test@Example.com  ' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Join the wait list' }))

    await waitFor(() => {
      expect(mockState.joinWaitlist).toHaveBeenCalledWith({
        email: 'test@example.com',
        source: 'landing-cinematic',
      })
    })

    expect(
      screen.getByText(
        'You are on the list. We will email you as soon as GlotCap is ready.',
      ),
    ).not.toBeNull()
  })

  it('supports switching from waitlist flow to invite-code flow', () => {
    const onOpenChange = vi.fn()
    const onHaveCode = vi.fn()

    render(
      <WaitlistDialog
        open
        onOpenChange={onOpenChange}
        onHaveCode={onHaveCode}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Click here if you have a sign up code.',
      }),
    )

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onHaveCode).toHaveBeenCalledTimes(1)
  })
})
