'use client'

import { useEffect, useState } from 'react'
import { cn } from '../ui'
import type { ReactNode } from 'react'

interface UnderConstructionProps {
  /** Title text */
  title?: string
  /** Description message */
  message?: string
  /** Optional additional content */
  children?: ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Under construction placeholder component.
 * Shows when a site/feature is not yet ready for public use.
 *
 * Includes inline style fallbacks to ensure readability regardless
 * of external theme CSS loading state.
 */
export function UnderConstruction({
  title = 'Under Construction',
  message = "We're working hard to finish this site. Please check back soon.",
  children,
  className,
}: UnderConstructionProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check initial dark mode state
    const updateDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    updateDark()

    // Observe changes to the HTML class list to react to theme toggles
    const observer = new MutationObserver(updateDark)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  // Inline style fallbacks to ensure readability regardless of external theme CSS
  const cardStyle: React.CSSProperties = isDark
    ? { background: '#0b0b0b', color: '#f3f4f6', borderColor: '#27272a' }
    : { background: '#ffffff', color: '#111827', borderColor: '#e5e7eb' }

  const titleStyle: React.CSSProperties = isDark
    ? { color: '#f3f4f6' }
    : { color: '#111827' }

  const messageStyle: React.CSSProperties = isDark
    ? { color: '#9ca3af' }
    : { color: '#374151' }

  return (
    <section className={cn('w-full p-8 my-12 flex justify-center', className)}>
      <div
        className="max-w-2xl rounded-xl border p-8 text-center shadow md:p-10"
        role="status"
        aria-live="polite"
        style={cardStyle}
      >
        <div className="mb-2 text-5xl" aria-hidden="true">
          🚧
        </div>
        <h1 className="mt-1 mb-2 text-2xl font-bold" style={titleStyle}>
          {title}
        </h1>
        <p className="m-0" style={messageStyle}>
          {message}
        </p>
      </div>
      {children}
    </section>
  )
}
