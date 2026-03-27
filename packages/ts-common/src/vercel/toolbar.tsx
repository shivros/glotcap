'use client'

import { useEffect } from 'react'

interface VercelToolbarProps {
  enable?: boolean
}

export function VercelToolbar({ enable = false }: VercelToolbarProps) {
  useEffect(() => {
    if (!enable) return

    let cleanup: (() => void) | undefined

    const mountToolbar = async () => {
      try {
        const { mountVercelToolbar } = await import('@vercel/toolbar/vite')
        const maybeCleanup = mountVercelToolbar()
        cleanup = typeof maybeCleanup === 'function' ? maybeCleanup : undefined
      } catch (error) {
        console.error('Vercel Toolbar: Failed to mount', error)
      }
    }

    mountToolbar()

    return () => {
      cleanup?.()
    }
  }, [enable])

  return null
}
