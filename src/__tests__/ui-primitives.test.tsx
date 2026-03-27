import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge, badgeVariants } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

describe('UI primitives', () => {
  it('exposes semantic variant classes for buttons and badges', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain(
      'var(--glotcap-border)',
    )
    expect(buttonVariants({ variant: 'default' })).toContain(
      'var(--glotcap-teal)',
    )

    expect(badgeVariants({ variant: 'outline' })).toContain(
      'var(--glotcap-border)',
    )
    expect(badgeVariants({ variant: 'default' })).toContain(
      'var(--glotcap-teal)',
    )
  })

  it('renders themed card, input, and textarea slots', () => {
    render(
      <>
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description</CardDescription>
            <CardAction>
              <Badge>Live</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Input aria-label="Test input" />
          </CardContent>
          <CardFooter>
            <Textarea aria-label="Test textarea" />
          </CardFooter>
        </Card>
      </>,
    )

    expect(screen.getByText('Card title').getAttribute('data-slot')).toBe(
      'card-title',
    )
    expect(screen.getByText('Card description').getAttribute('data-slot')).toBe(
      'card-description',
    )
    expect(screen.getByText('Live').getAttribute('data-slot')).toBe('badge')
    expect(screen.getByLabelText('Test input').getAttribute('data-slot')).toBe(
      'input',
    )
    expect(
      screen.getByLabelText('Test textarea').getAttribute('data-slot'),
    ).toBe('textarea')
  })
})
