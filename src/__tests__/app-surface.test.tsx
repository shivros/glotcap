import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppPageContainer, AppSurface } from '@/components/app-surface'

describe('AppSurface', () => {
  it('renders shared app backdrop and page container layout', () => {
    const { container } = render(
      <AppSurface>
        <AppPageContainer>
          <p>Surface content</p>
        </AppPageContainer>
      </AppSurface>,
    )

    const surface = container.firstElementChild as HTMLElement

    expect(surface.className).toContain('min-h-screen')
    expect(surface.className).toContain('bg-[#080c10]')
    expect(screen.getByText('Surface content')).not.toBeNull()

    const pageContainer = container.querySelector('div.max-w-6xl')
    expect(pageContainer).not.toBeNull()
  })
})
