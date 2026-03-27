import { useEffect, useMemo } from 'react'

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

export type PaginationClassNames = {
  root?: string
  range?: string
  controls?: string
  selectWrapper?: string
  select?: string
  pages?: string
  pageButton?: string
  activePageButton?: string
  ellipsis?: string
}

type PaginationControlsProps = {
  totalCount: number
  pageSize: number
  currentPage: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: Array<number>
  className?: string
  classNames?: PaginationClassNames
}

export function PaginationControls({
  totalCount,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
  classNames,
}: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(currentPage, 1), pageCount)
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalCount)
  const pageItems = useMemo(() => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1)
    }
    const visible = new Set<number>()
    visible.add(1)
    visible.add(pageCount)
    for (let page = safePage - 1; page <= safePage + 1; page += 1) {
      if (page >= 1 && page <= pageCount) {
        visible.add(page)
      }
    }
    if (safePage <= 3) {
      visible.add(2)
      visible.add(3)
      visible.add(4)
    }
    if (safePage >= pageCount - 2) {
      visible.add(pageCount - 3)
      visible.add(pageCount - 2)
      visible.add(pageCount - 1)
    }
    const sorted = Array.from(visible)
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((a, b) => a - b)
    const items: Array<number | 'ellipsis'> = []
    let last = 0
    for (const page of sorted) {
      if (last && page - last > 1) {
        items.push('ellipsis')
      }
      items.push(page)
      last = page
    }
    return items
  }, [pageCount, safePage])

  useEffect(() => {
    if (safePage !== currentPage) {
      onPageChange(safePage)
    }
  }, [currentPage, onPageChange, safePage])

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-xs ${
        classNames?.root ?? ''
      } ${className ?? ''}`}
    >
      <span className={classNames?.range ?? ''}>
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </span>
      <div
        className={`flex flex-wrap items-center gap-3 ${
          classNames?.controls ?? ''
        }`}
      >
        <label
          className={`flex items-center gap-2 text-xs ${
            classNames?.selectWrapper ?? ''
          }`}
        >
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className={`rounded-full border px-2 py-1 text-xs font-semibold ${classNames?.select ?? ''}`}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {pageCount > 1 ? (
          <div
            className={`flex flex-wrap items-center gap-2 ${
              classNames?.pages ?? ''
            }`}
          >
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className={`px-2 ${classNames?.ellipsis ?? ''}`}
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    item === safePage
                      ? (classNames?.activePageButton ?? '')
                      : (classNames?.pageButton ?? '')
                  }`}
                  aria-current={item === safePage ? 'page' : undefined}
                >
                  {item}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
