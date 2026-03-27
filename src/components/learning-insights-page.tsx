import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { EyeOff, Sparkles } from 'lucide-react'
import { PaginationControls } from 'ts-common/ui'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { PaginationClassNames } from 'ts-common/ui'
import { AccountMenu } from '@/components/account-menu'
import { AppPageContainer, AppSurface } from '@/components/app-surface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languageOptions } from '@/lib/speaking-coach-languages'
import { cn } from '@/lib/utils'
import {
  APP_BRAND_SURFACE_CLASS,
  APP_BRAND_TEXT_CLASS,
  APP_INPUT_SURFACE_CLASS,
  APP_LOGO_TILE_CLASS,
  APP_NEUTRAL_BADGE_SOFT_CLASS,
  APP_PANEL_CLASS,
  APP_POPOVER_SURFACE_CLASS,
  APP_SAND_SOFT_CLASS,
  APP_TEXT_EMPHASIS_CLASS,
  APP_TEXT_LABEL_CLASS,
  APP_TEXT_MUTED_CLASS,
  APP_TEXT_SUBTLE_CLASS,
} from '@/theme/semantic'
import { useUserLanguagePreference } from '@/lib/use-user-language-preference'

const EXAMPLE_PAGE_SIZE_OPTIONS = [3, 6, 9]

const examplePaginationClassNames: PaginationClassNames = {
  root: `mt-3 ${APP_TEXT_SUBTLE_CLASS}`,
  range: APP_TEXT_SUBTLE_CLASS,
  controls: APP_TEXT_SUBTLE_CLASS,
  selectWrapper: APP_TEXT_SUBTLE_CLASS,
  select: cn('border bg-card/80 text-foreground', APP_NEUTRAL_BADGE_SOFT_CLASS),
  pages: APP_TEXT_SUBTLE_CLASS,
  pageButton: cn(
    'border text-muted-foreground hover:bg-card/80',
    APP_NEUTRAL_BADGE_SOFT_CLASS,
  ),
  activePageButton: 'border-primary/40 bg-primary/10 text-primary',
  ellipsis: 'text-muted-foreground/70',
}

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export function LearningInsightsPage() {
  const { languageId, setLanguageId, isHydratingLanguagePreference } =
    useUserLanguagePreference()
  const activeLanguage = useMemo(
    () =>
      languageOptions.find((option) => option.id === languageId) ??
      languageOptions[0],
    [languageId],
  )

  const [showIgnored, setShowIgnored] = useState(false)
  const [optimisticIgnored, setOptimisticIgnored] = useState<
    Set<Id<'speakingEvents'>>
  >(new Set())
  const insights = useQuery(
    api.learningInsights.listLearningInsights,
    isHydratingLanguagePreference
      ? 'skip'
      : {
          language: activeLanguage.targetLanguage,
          includeRejected: showIgnored,
        },
  )
  const rejectExample = useMutation(
    api.learningInsights.rejectLearningInsightExample,
  )
  const restoreExample = useMutation(
    api.learningInsights.restoreLearningInsightExample,
  )

  const setExampleIgnored = useCallback(
    (correctionId: Id<'speakingEvents'>, ignored: boolean) => {
      setOptimisticIgnored((prev) => {
        const next = new Set(prev)
        if (ignored) {
          next.add(correctionId)
        } else {
          next.delete(correctionId)
        }
        return next
      })
    },
    [],
  )

  const handleRejectExample = useCallback(
    async (example: { correctionId: Id<'speakingEvents'> }) => {
      setExampleIgnored(example.correctionId, true)
      try {
        await rejectExample({
          language: activeLanguage.targetLanguage,
          correctionId: example.correctionId,
        })
      } catch (error) {
        setExampleIgnored(example.correctionId, false)
        console.error('Failed to ignore learning insight example', error)
      }
    },
    [activeLanguage.targetLanguage, rejectExample, setExampleIgnored],
  )

  const handleRestoreExample = useCallback(
    async (example: { correctionId: Id<'speakingEvents'> }) => {
      setExampleIgnored(example.correctionId, false)
      try {
        await restoreExample({
          language: activeLanguage.targetLanguage,
          correctionId: example.correctionId,
        })
      } catch (error) {
        setExampleIgnored(example.correctionId, true)
        console.error('Failed to restore learning insight example', error)
      }
    },
    [activeLanguage.targetLanguage, restoreExample, setExampleIgnored],
  )

  if (isHydratingLanguagePreference || !insights) {
    return <PageSpinner />
  }

  const languageMenu = (
    <div className="grid gap-2">
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.3em]',
          APP_TEXT_LABEL_CLASS,
        )}
      >
        Language
      </p>
      <Select
        value={activeLanguage.id}
        onValueChange={(value) => value && setLanguageId(value)}
      >
        <SelectTrigger
          className={cn('w-full px-3 py-2', APP_INPUT_SURFACE_CLASS)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={APP_POPOVER_SURFACE_CLASS}>
          {languageOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <AppSurface>
      <AppPageContainer>
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl',
                APP_LOGO_TILE_CLASS,
              )}
            >
              GC
            </div>
            <div>
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.4em]',
                  APP_BRAND_TEXT_CLASS,
                )}
              >
                GlotCap
              </p>
              <p className={cn('text-sm', APP_TEXT_MUTED_CLASS)}>
                Learning insights
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={showIgnored ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowIgnored((prev) => !prev)}
            >
              <EyeOff className="size-3.5" />
              {showIgnored ? 'Hide ignored' : 'Show ignored'}
            </Button>
            <AccountMenu extraContent={languageMenu} />
          </div>
        </header>

        <main className="grid gap-4">
          {insights.length === 0 ? (
            <Card className={APP_PANEL_CLASS}>
              <CardContent className="py-10 text-center">
                <div
                  className={cn(
                    'mx-auto flex size-12 items-center justify-center rounded-full',
                    APP_BRAND_SURFACE_CLASS,
                  )}
                >
                  <Sparkles className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  No recurring insights yet
                </h2>
                <p className={cn('mt-2 text-sm', APP_TEXT_SUBTLE_CLASS)}>
                  Finish a few sessions and we’ll highlight repeated patterns
                  here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {insights.map((insight) => (
                <Card
                  key={insight._id}
                  className={cn(
                    APP_PANEL_CLASS,
                    insight.status === 'rejected' && 'opacity-70',
                  )}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base capitalize">
                        {insight.canonical}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={APP_NEUTRAL_BADGE_SOFT_CLASS}
                      >
                        {insight.category}
                      </Badge>
                    </div>
                    <CardDescription className={APP_TEXT_MUTED_CLASS}>
                      {insight.totalCount} occurrences
                      {showIgnored && insight.ignoredCount > 0
                        ? ` · ${insight.ignoredCount} ignored`
                        : ''}
                      {' · Last seen '}
                      {formatTimestamp(insight.lastSeenAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <InsightExamples
                      canonicalKey={insight.canonicalKey}
                      language={activeLanguage.targetLanguage}
                      includeIgnored={showIgnored}
                      fallbackExamples={insight.examples}
                      optimisticIgnored={optimisticIgnored}
                      onIgnore={handleRejectExample}
                      onRestore={handleRestoreExample}
                    />
                    <div className="flex items-center justify-between">
                      <p className={cn('text-xs', APP_TEXT_LABEL_CLASS)}>
                        First seen {formatTimestamp(insight.firstSeenAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </AppPageContainer>
    </AppSurface>
  )
}

type InsightExample = {
  correctionId: Id<'speakingEvents'>
  original: string
  corrected: string
  explanation?: string | null
  timestamp: number
  rejected?: boolean
}

type InsightExamplesProps = {
  canonicalKey: string
  language: string
  includeIgnored: boolean
  fallbackExamples: Array<InsightExample>
  optimisticIgnored: Set<Id<'speakingEvents'>>
  onIgnore: (example: { correctionId: Id<'speakingEvents'> }) => void
  onRestore: (example: { correctionId: Id<'speakingEvents'> }) => void
}

function InsightExamples({
  canonicalKey,
  language,
  includeIgnored,
  fallbackExamples,
  optimisticIgnored,
  onIgnore,
  onRestore,
}: InsightExamplesProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(EXAMPLE_PAGE_SIZE_OPTIONS[0])

  const examplePage = useQuery(
    api.learningInsights.listLearningInsightExamples,
    {
      language,
      canonicalKey,
      page,
      pageSize,
      includeRejected: includeIgnored,
    },
  )

  const examples = examplePage?.examples ?? fallbackExamples
  const totalCount = examplePage?.totalCount ?? examples.length
  const visibleExamples = examples.filter((example) => {
    const isIgnored =
      example.rejected || optimisticIgnored.has(example.correctionId)
    if (!includeIgnored && isIgnored) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      {visibleExamples.length === 0 ? (
        <p className={cn('text-xs', APP_TEXT_LABEL_CLASS)}>
          No examples available yet.
        </p>
      ) : null}
      {visibleExamples.map((example) => {
        const isIgnored =
          example.rejected || optimisticIgnored.has(example.correctionId)
        return (
          <div
            key={example.correctionId}
            className={cn(
              'rounded-xl p-3',
              APP_SAND_SOFT_CLASS,
              isIgnored && 'opacity-70',
            )}
          >
            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 text-xs',
                APP_TEXT_LABEL_CLASS,
              )}
            >
              <span>{formatTimestamp(example.timestamp)}</span>
              {isIgnored ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore(example)}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onIgnore(example)}
                >
                  Ignore
                </Button>
              )}
            </div>
            <p
              className={cn(
                'mt-3 text-xs font-semibold uppercase tracking-[0.2em]',
                APP_TEXT_LABEL_CLASS,
              )}
            >
              Original
            </p>
            <p className="mt-1 text-sm">{example.original}</p>
            <p
              className={cn(
                'mt-3 text-xs font-semibold uppercase tracking-[0.2em]',
                APP_TEXT_LABEL_CLASS,
              )}
            >
              Corrected
            </p>
            <p className="mt-1 text-sm font-semibold">{example.corrected}</p>
            <p
              className={cn(
                'mt-3 text-xs font-semibold uppercase tracking-[0.2em]',
                APP_TEXT_LABEL_CLASS,
              )}
            >
              Explanation
            </p>
            {example.explanation ? (
              <p className={cn('mt-1 text-sm', APP_TEXT_EMPHASIS_CLASS)}>
                {example.explanation}
              </p>
            ) : (
              <p className={cn('mt-1 text-sm', APP_TEXT_LABEL_CLASS)}>
                No explanation available.
              </p>
            )}
          </div>
        )
      })}
      {totalCount > pageSize ? (
        <PaginationControls
          totalCount={totalCount}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          pageSizeOptions={EXAMPLE_PAGE_SIZE_OPTIONS}
          classNames={examplePaginationClassNames}
        />
      ) : null}
    </div>
  )
}
