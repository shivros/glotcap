/**
 * UI utilities
 *
 * Common utilities for React/UI components.
 */

import { clsx } from 'clsx'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { twMerge } from 'tailwind-merge'
import { decodeHtmlEntities } from '../parse'

import type { ClassValue } from 'clsx'
import type { IOptions } from 'sanitize-html'

export {
  DEFAULT_PAGE_SIZE_OPTIONS,
  PaginationControls,
  type PaginationClassNames,
} from './pagination'
export {
  ImageReviewCarousel,
  type ImageReviewCarouselProps,
  type ImageReviewItem,
} from './image-review'

/**
 * Merge class names with Tailwind CSS class merging.
 *
 * Combines clsx for conditional classes with tailwind-merge
 * to properly handle conflicting Tailwind classes.
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

const INLINE_ALLOWED_TAGS = [
  'a',
  'b',
  'strong',
  'em',
  'i',
  'code',
  'span',
  'br',
  'sup',
  'sub',
]

const RICH_ALLOWED_TAGS = [
  ...INLINE_ALLOWED_TAGS,
  'p',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'img',
]

const MARKDOWN_ALLOWED_TAGS = [
  ...RICH_ALLOWED_TAGS,
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'del',
]

const SANITIZE_BASE_OPTIONS: IOptions = {
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noreferrer',
        target: '_blank',
      },
    }),
    img: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      },
    }),
  },
}

const buildSanitizeOptions = (allowedTags: Array<string>): IOptions => ({
  ...SANITIZE_BASE_OPTIONS,
  allowedTags,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: [
      'src',
      'alt',
      'title',
      'loading',
      'decoding',
      'referrerpolicy',
      'width',
      'height',
    ],
  },
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },
})

export function sanitizeInlineHtml(input: string): string {
  return sanitizeHtml(
    decodeHtmlEntities(input),
    buildSanitizeOptions(INLINE_ALLOWED_TAGS),
  )
}

export function sanitizeRichHtml(input: string): string {
  return sanitizeHtml(
    decodeHtmlEntities(input),
    buildSanitizeOptions(RICH_ALLOWED_TAGS),
  )
}

export function sanitizeMarkdownHtml(input: string): string {
  const options = buildSanitizeOptions(MARKDOWN_ALLOWED_TAGS)
  options.allowedAttributes = {
    ...(options.allowedAttributes ?? {}),
    th: ['colspan', 'rowspan', 'align'],
    td: ['colspan', 'rowspan', 'align'],
  }
  return sanitizeHtml(input, options)
}

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(input: string): string {
  if (!input.trim()) {
    return ''
  }
  const parsed = marked.parse(input)
  if (typeof parsed !== 'string') {
    return ''
  }
  return sanitizeMarkdownHtml(parsed)
}
