import { useCallback, useEffect, useRef } from 'react'
import type { DependencyList } from 'react'

const DEFAULT_THRESHOLD = 50

type UseFollowScrollOptions = {
  /** Dependency array that triggers auto-scroll when changed */
  deps: DependencyList
  /** Pixel threshold from bottom to consider "at bottom". Default: 50 */
  threshold?: number
  /** Use smooth scroll behavior. Default: true */
  smooth?: boolean
}

type UseFollowScrollReturn = {
  /** Attach this ref to the scrollable container div */
  ref: React.RefObject<HTMLDivElement | null>
  /** Whether the container is currently following (at bottom) — render-time snapshot */
  isFollowing: boolean
}

export const useFollowScroll = ({
  deps,
  threshold = DEFAULT_THRESHOLD,
  smooth = true,
}: UseFollowScrollOptions): UseFollowScrollReturn => {
  const ref = useRef<HTMLDivElement | null>(null)
  const isFollowingRef = useRef(true)
  const smoothRef = useRef(smooth)
  smoothRef.current = smooth

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isFollowingRef.current = distanceFromBottom <= threshold
  }, [threshold])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // Auto-scroll to bottom when deps change, but only if following
  useEffect(() => {
    const el = ref.current
    if (!el || !isFollowingRef.current) return

    el.scrollTo({
      top: el.scrollHeight,
      behavior: smoothRef.current ? 'smooth' : 'instant',
    })
  }, deps)

  return { ref, isFollowing: isFollowingRef.current }
}
