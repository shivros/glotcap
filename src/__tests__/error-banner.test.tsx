import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBanner } from '@/components/error-banner'

describe('ErrorBanner', () => {
  it('renders alert message with no action button by default', () => {
    render(<ErrorBanner message="Something failed" />)

    expect(screen.getByRole('alert').textContent).toContain('Something failed')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })

  it('renders custom action button and invokes callback', () => {
    const onAction = vi.fn()

    render(
      <ErrorBanner
        message="Something failed"
        actionLabel="Retry"
        onAction={onAction}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
