import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

vi.mock('@base-ui/react/alert-dialog', () => {
  const Root = ({ children }: { children: ReactNode }) => <div>{children}</div>
  const Trigger = ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  )
  const Portal = ({ children }: { children: ReactNode }) => <>{children}</>
  const Backdrop = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  )
  const Popup = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  )
  const Title = ({
    children,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>
  const Description = ({
    children,
    ...props
  }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>
  const Close = ({
    children,
    render: renderProp,
    onClick,
    className,
    ...props
  }: {
    children?: ReactNode
    render?: ReactElement<{ className?: string; children?: ReactNode }>
    onClick?: () => void
    className?: string
  }) => {
    if (renderProp) {
      return (
        <button
          type="button"
          className={`${renderProp.props.className ?? ''} ${className ?? ''}`.trim()}
          onClick={onClick}
          {...props}
        >
          {children ?? renderProp.props.children}
        </button>
      )
    }

    return (
      <button type="button" className={className} onClick={onClick} {...props}>
        {children}
      </button>
    )
  }

  return {
    AlertDialog: {
      Root,
      Trigger,
      Portal,
      Backdrop,
      Popup,
      Title,
      Description,
      Close,
    },
  }
})

describe('AlertDialog UI wrapper', () => {
  it('renders title, description, and footer actions with themed classes', () => {
    const onCancel = vi.fn()
    const onAction = vi.fn()

    render(
      <AlertDialog open>
        <AlertDialogContent className="custom-content">
          <AlertDialogHeader>
            <AlertDialogMedia>media</AlertDialogMedia>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onAction}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    )

    expect(screen.getByText('Delete project?')).not.toBeNull()
    expect(screen.getByText('This action cannot be undone.')).not.toBeNull()

    const popup = screen
      .getByText('Delete project?')
      .closest('[data-slot="alert-dialog-content"]') as HTMLElement
    expect(popup.className).toContain('custom-content')
    expect(popup.className).toContain('var(--glotcap-surface)')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
