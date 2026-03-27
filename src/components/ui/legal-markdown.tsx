import Markdown from 'react-markdown'
import type { ReactNode } from 'react'

const LEGAL_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-4 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-white/80">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-3 ml-6 list-disc">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-3 ml-6 list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="mb-2">{children}</li>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-6 text-3xl font-bold text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-4 mt-8 text-2xl font-semibold text-white first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-3 mt-6 text-xl font-semibold text-white/80">
      {children}
    </h3>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-white/10 pl-4 italic text-white/40">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-sm">
      {children}
    </code>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--glotcap-sky)] underline underline-offset-2 hover:text-[var(--glotcap-mint)]"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-white/10" />,
}

export function LegalMarkdown({ content }: { content: string }) {
  return (
    <div className="leading-relaxed text-white/50">
      <Markdown components={LEGAL_COMPONENTS}>{content}</Markdown>
    </div>
  )
}
