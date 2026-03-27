import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AppModalContent } from '@/components/ui/app-modal-content'
import { APP_MODAL_CONTENT_CLASS } from '@/theme/semantic'

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialogContent: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <div data-testid="alert-dialog-content" className={className}>
      {children}
    </div>
  ),
}))

describe('AppModalContent', () => {
  it('applies the shared semantic modal class contract', () => {
    render(
      <AppModalContent className="custom-modal">Modal body</AppModalContent>,
    )

    const content = screen.getByTestId('alert-dialog-content')

    expect(content.className).toContain(APP_MODAL_CONTENT_CLASS)
    expect(content.className).toContain('custom-modal')
    expect(screen.getByText('Modal body')).not.toBeNull()
  })
})
