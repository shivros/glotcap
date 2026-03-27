import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ImageReviewItem = {
  id: string
  imageUrl: string | null
  promptText?: string
  promptLabel?: string
}

export type ImageReviewCarouselProps = {
  items: Array<ImageReviewItem>
  imageAlt?: string
  imageHeightClassName?: string
  lightboxHeightClassName?: string
  emptyState?: ReactNode
  showPromptToggle?: boolean
  showThumbnails?: boolean
  allowLightbox?: boolean
  className?: string
  thumbnailClassName?: string
  activeThumbnailClassName?: string
  lightboxThumbnailClassName?: string
  lightboxActiveThumbnailClassName?: string
  onIndexChange?: (index: number) => void
}

export function ImageReviewCarousel({
  items,
  imageAlt = 'Generated',
  imageHeightClassName = 'h-[360px]',
  lightboxHeightClassName = 'h-[70vh]',
  emptyState = 'Images are still generating.',
  showPromptToggle = true,
  showThumbnails = true,
  allowLightbox = true,
  className,
  thumbnailClassName,
  activeThumbnailClassName,
  lightboxThumbnailClassName,
  lightboxActiveThumbnailClassName,
  onIndexChange,
}: ImageReviewCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  const currentItem = items[activeIndex]
  const currentImageUrl = currentItem?.imageUrl ?? null
  const hasMultiple = items.length > 1

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, items.length])

  useEffect(() => {
    if (!onIndexChange) return
    onIndexChange(activeIndex)
  }, [activeIndex, onIndexChange])

  useEffect(() => {
    if (lightboxIndex === null) {
      setShowPrompt(false)
      return
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null)
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setLightboxIndex((current) => {
        const next = (current ?? 0) + delta
        const length = items.length || 1
        return (next + length) % length
      })
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [items.length, lightboxIndex])

  const sliverButtonBase =
    'group absolute inset-y-0 z-10 flex w-12 items-center justify-center bg-black/10 text-white/80 transition hover:bg-black/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

  const lightboxSliverButtonBase =
    'group absolute inset-y-0 z-10 flex w-14 items-center justify-center bg-black/20 text-white/80 transition hover:bg-black/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'

  const handlePrev = () => {
    if (!hasMultiple) return
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  const handleNext = () => {
    if (!hasMultiple) return
    setActiveIndex((current) => (current + 1) % items.length)
  }

  const handleLightboxPrev = () => {
    if (!hasMultiple) return
    setLightboxIndex((current) =>
      current === null ? 0 : (current - 1 + items.length) % items.length,
    )
  }

  const handleLightboxNext = () => {
    if (!hasMultiple) return
    setLightboxIndex((current) =>
      current === null ? 0 : (current + 1) % items.length,
    )
  }

  const lightboxItem = useMemo(() => {
    if (lightboxIndex === null) return null
    return items[lightboxIndex] ?? null
  }, [items, lightboxIndex])

  const lightboxImageUrl = lightboxItem?.imageUrl ?? null

  return (
    <div className={className}>
      {items.length > 0 && currentImageUrl ? (
        <>
          <div className="relative overflow-hidden rounded-3xl border border-[rgba(15,18,22,0.12)] bg-white">
            <button
              type="button"
              className={`${sliverButtonBase} left-0 border-r border-white/50`}
              onClick={handlePrev}
              disabled={!hasMultiple}
              aria-label="Previous image"
            >
              <span className="text-2xl">‹</span>
            </button>
            <button
              type="button"
              className={`${sliverButtonBase} right-0 border-l border-white/50`}
              onClick={handleNext}
              disabled={!hasMultiple}
              aria-label="Next image"
            >
              <span className="text-2xl">›</span>
            </button>
            <button
              type="button"
              className="group relative block w-full"
              onClick={() => {
                if (!allowLightbox) return
                setLightboxIndex(activeIndex)
              }}
            >
              <img
                src={currentImageUrl}
                alt={imageAlt}
                className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${imageHeightClassName}`}
              />
            </button>
          </div>

          {showThumbnails && items.length > 1 ? (
            <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-2">
              {items.map((item, index) => (
                <button
                  key={`thumb-${item.id}`}
                  type="button"
                  className={`h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border ${
                    activeIndex === index
                      ? (activeThumbnailClassName ??
                        'border-[rgba(15,18,22,0.4)]')
                      : (thumbnailClassName ?? 'border-[rgba(15,18,22,0.12)]')
                  }`}
                  onClick={() => setActiveIndex(index)}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt="Thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--pg-ink-muted)]">
                      Pending
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-[240px] items-center justify-center rounded-3xl border border-dashed border-[rgba(15,18,22,0.2)] text-sm text-[var(--pg-ink-muted)]">
          {emptyState}
        </div>
      )}

      {allowLightbox && lightboxIndex !== null ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              className="absolute -top-10 right-0 text-xs font-semibold text-white"
              onClick={() => setLightboxIndex(null)}
            >
              Close
            </button>
            {lightboxImageUrl ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
                  <button
                    type="button"
                    className={`${lightboxSliverButtonBase} left-0 border-r border-white/40`}
                    onClick={handleLightboxPrev}
                    disabled={!hasMultiple}
                    aria-label="Previous image"
                  >
                    <span className="text-3xl">‹</span>
                  </button>
                  <button
                    type="button"
                    className={`${lightboxSliverButtonBase} right-0 border-l border-white/40`}
                    onClick={handleLightboxNext}
                    disabled={!hasMultiple}
                    aria-label="Next image"
                  >
                    <span className="text-3xl">›</span>
                  </button>
                  <img
                    src={lightboxImageUrl}
                    alt={imageAlt}
                    className={`w-full object-contain ${lightboxHeightClassName}`}
                  />
                </div>
                {showThumbnails && items.length > 1 ? (
                  <div className="flex justify-center gap-3 overflow-x-auto pb-2">
                    {items.map((item, index) => (
                      <button
                        key={`lightbox-thumb-${item.id}`}
                        type="button"
                        className={`h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border ${
                          lightboxIndex === index
                            ? (lightboxActiveThumbnailClassName ??
                              'border-white')
                            : (lightboxThumbnailClassName ?? 'border-white/40')
                        }`}
                        onClick={() => setLightboxIndex(index)}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt="Thumbnail"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/60">
                            Pending
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {showPromptToggle && lightboxItem?.promptText ? (
                    <button
                      type="button"
                      className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold text-white"
                      onClick={() => setShowPrompt((value) => !value)}
                    >
                      {showPrompt ? 'Hide prompt' : 'Show prompt'}
                    </button>
                  ) : (
                    <span />
                  )}
                  <a
                    href={lightboxImageUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Download
                  </a>
                </div>
                {showPrompt && lightboxItem?.promptText ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                      {lightboxItem.promptLabel ?? 'Prompt'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">
                      {lightboxItem.promptText}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
