import { Link, createFileRoute } from '@tanstack/react-router'
import { LegalMarkdown } from '@/components/ui/legal-markdown'
import content from '@/content/legal/terms-of-service.md?raw'
import { cn } from '@/lib/utils'
import { APP_BRAND_TEXT_CLASS, APP_PANEL_CLASS } from '@/theme/semantic'

export const Route = createFileRoute('/terms-of-service')({
  component: TermsOfService,
})

function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#06090e] py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className={cn('rounded-2xl border p-8', APP_PANEL_CLASS)}>
          <LegalMarkdown content={content} />
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className={cn(
              'text-sm transition-colors hover:text-white',
              APP_BRAND_TEXT_CLASS,
            )}
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
