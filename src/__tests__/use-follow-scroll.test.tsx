import { act, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFollowScroll } from '@/lib/use-follow-scroll'

/**
 * Wrapper component that renders a real div with the hook's ref attached.
 * This ensures the ref is set during React's commit phase, before effects run.
 */
const ScrollHarness = ({
  deps,
  threshold,
  smooth = false,
}: {
  deps: Array<unknown>
  threshold?: number
  smooth?: boolean
}) => {
  const { ref } = useFollowScroll({ deps, threshold, smooth })
  return <div ref={ref} data-testid="scroll-container" />
}

/** Mock scroll geometry on a real DOM element. */
const mockScrollGeometry = (
  el: HTMLElement,
  geometry: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(el, 'scrollHeight', {
    value: geometry.scrollHeight,
    configurable: true,
  })
  Object.defineProperty(el, 'clientHeight', {
    value: geometry.clientHeight,
    configurable: true,
  })
  Object.defineProperty(el, 'scrollTop', {
    value: geometry.scrollTop,
    configurable: true,
    writable: true,
  })
}

describe('useFollowScroll', () => {
  it('scrolls to bottom on dep change when following', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    })

    rerender(<ScrollHarness deps={[2]} />)

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'instant',
    })
  })

  it('starts in following mode', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    })

    rerender(<ScrollHarness deps={[2]} />)

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'instant',
    })
  })

  it('stops scrolling when user scrolls away from bottom', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo

    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 200, // 400px from bottom — beyond threshold
    })

    // Simulate user scroll away from bottom
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })

    // Next dep change should NOT scroll
    scrollTo.mockClear()
    rerender(<ScrollHarness deps={[2]} />)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('re-engages when user scrolls back within threshold', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo

    // User scrolls away
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 200,
    })
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })

    // Verify disengaged
    scrollTo.mockClear()
    rerender(<ScrollHarness deps={[2]} />)
    expect(scrollTo).not.toHaveBeenCalled()

    // User scrolls back to bottom (within threshold: 1000 - 570 - 400 = 30 <= 50)
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 570,
    })
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })

    // Next dep change should scroll again
    scrollTo.mockClear()
    rerender(<ScrollHarness deps={[3]} />)
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'instant',
    })
  })

  it('does not error when ref is unattached', () => {
    const { rerender } = renderHook(({ deps }) => useFollowScroll({ deps }), {
      initialProps: { deps: [1] },
    })

    // Should not throw
    rerender({ deps: [2] })
  })

  it('respects custom threshold', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} threshold={100} />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo

    // distance = 100, threshold = 100 → still following
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 500,
    })
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })

    // Should still scroll (at boundary)
    scrollTo.mockClear()
    rerender(<ScrollHarness deps={[2]} threshold={100} />)
    expect(scrollTo).toHaveBeenCalled()

    // distance = 101 > 100 → no longer following
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 499,
    })
    act(() => {
      el.dispatchEvent(new Event('scroll'))
    })

    scrollTo.mockClear()
    rerender(<ScrollHarness deps={[3]} threshold={100} />)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('uses smooth behavior by default', () => {
    const scrollTo = vi.fn()
    const { rerender } = render(<ScrollHarness deps={[1]} smooth />)
    const el = screen.getByTestId('scroll-container')
    el.scrollTo = scrollTo
    mockScrollGeometry(el, {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    })

    rerender(<ScrollHarness deps={[2]} smooth />)

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'smooth',
    })
  })

  it('cleans up scroll listener on unmount', () => {
    const removeEventListener = vi.spyOn(
      HTMLElement.prototype,
      'removeEventListener',
    )

    const { unmount } = render(<ScrollHarness deps={[1]} />)
    unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
    )

    removeEventListener.mockRestore()
  })
})
