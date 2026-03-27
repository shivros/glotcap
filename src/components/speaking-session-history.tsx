import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { AlertTriangle, Check, Copy, History } from 'lucide-react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/account-menu'
import { AppPageContainer, AppSurface } from '@/components/app-surface'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageSpinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  APP_BRAND_TEXT_CLASS,
  APP_FIX_NOTE_CLASS,
  APP_GOOD_NOTE_CLASS,
  APP_LOGO_TILE_CLASS,
  APP_NEUTRAL_BADGE_CLASS,
  APP_PANEL_CLASS,
  APP_PANEL_SOFT_CLASS,
  APP_SAND_SOFT_CLASS,
  APP_TEXT_LABEL_CLASS,
  APP_TEXT_LABEL_STRONG_CLASS,
  APP_TEXT_MUTED_CLASS,
} from '@/theme/semantic'

const historyTranscriptFallback = [
  {
    speaker: 'Coach',
    text: 'Start a session to build your transcript history.',
  },
]

const formatSessionTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const formatEventSpeaker = (
  speaker?: 'user' | 'teacher' | 'coach' | 'system' | null,
) => {
  if (speaker === 'user') {
    return 'You'
  }
  if (speaker === 'teacher') {
    return 'Teacher'
  }
  if (speaker === 'coach') {
    return 'Coach'
  }
  return 'System'
}

const formatCorrectionsMarkdown = (
  entries:
    | Array<{
        createdAt: number
        transcript: {
          speaker?: 'user' | 'teacher' | 'coach' | 'system' | null
          text: string
        }
        corrections: Array<{
          title: string
          detail: string
          severity?: 'low' | 'medium' | 'high' | 'positive' | null
        }>
      }>
    | null
    | undefined,
  formatTimestamp: (timestamp: number) => string,
) => {
  if (!entries || entries.length === 0) {
    return ''
  }

  const lines: Array<string> = ['# Corrections']
  let hasCorrections = false

  for (const entry of entries) {
    if (entry.corrections.length === 0) {
      continue
    }
    hasCorrections = true
    lines.push(`- **${formatTimestamp(entry.createdAt)}**`)
    for (const note of entry.corrections) {
      const detail = note.detail.trim()
      if (!detail) {
        continue
      }
      lines.push(`  - **${note.title}** — ${detail}`)
    }
  }

  return hasCorrections ? lines.join('\n') : ''
}

const formatVocabularyMarkdown = (
  entries:
    | Array<{
        createdAt: number
        vocabulary: Array<{ word: string; definition: string }>
      }>
    | null
    | undefined,
  formatTimestamp: (timestamp: number) => string,
) => {
  if (!entries || entries.length === 0) {
    return ''
  }

  const lines: Array<string> = ['# Vocabulary']
  let hasVocabulary = false

  for (const entry of entries) {
    if (entry.vocabulary.length === 0) {
      continue
    }
    hasVocabulary = true
    lines.push(`- **${formatTimestamp(entry.createdAt)}**`)
    for (const note of entry.vocabulary) {
      const word = note.word.trim()
      const definition = note.definition.trim()
      if (!word || !definition) {
        continue
      }
      lines.push(`  - **${word}** — ${definition}`)
    }
  }

  return hasVocabulary ? lines.join('\n') : ''
}

const formatTranscriptMarkdown = (
  entries:
    | Array<{
        createdAt: number
        transcript: {
          speaker?: 'user' | 'teacher' | 'coach' | 'system' | null
          text: string
          translatedText?: string | null
        }
      }>
    | null
    | undefined,
  formatTimestamp: (timestamp: number) => string,
) => {
  if (!entries || entries.length === 0) {
    return ''
  }

  const lines: Array<string> = ['# Transcript']

  for (const entry of entries) {
    const text = entry.transcript.text.trim()
    if (!text) {
      continue
    }
    lines.push(
      `- **${formatTimestamp(entry.createdAt)} — ${formatEventSpeaker(
        entry.transcript.speaker ?? null,
      )}:** ${text}`,
    )
    const translation = entry.transcript.translatedText?.trim()
    if (translation) {
      lines.push(`  - _${translation}_`)
    }
  }

  return lines.length > 1 ? lines.join('\n') : ''
}

type SpeakingSessionHistoryProps = {
  sessionId: Id<'speakingSessions'>
}

export function SpeakingSessionHistory({
  sessionId,
}: SpeakingSessionHistoryProps) {
  const sessions =
    useQuery(api.speaking.listRecentSessions, { limit: 30 }) ?? []
  const session = sessions.find((entry) => entry._id === sessionId) ?? null
  const historyEntries = useQuery(api.speaking.getSessionTranscript, {
    sessionId,
  })

  const historyTranscriptScrollRef = useRef<HTMLDivElement | null>(null)
  const historyCorrectionsScrollRef = useRef<HTMLDivElement | null>(null)
  const historyVocabularyScrollRef = useRef<HTMLDivElement | null>(null)
  const toastTimeoutRef = useRef<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const transcriptMarkdown = useMemo(
    () => formatTranscriptMarkdown(historyEntries, formatSessionTimestamp),
    [historyEntries],
  )
  const correctionsMarkdown = useMemo(
    () => formatCorrectionsMarkdown(historyEntries, formatSessionTimestamp),
    [historyEntries],
  )
  const vocabularyMarkdown = useMemo(
    () => formatVocabularyMarkdown(historyEntries, formatSessionTimestamp),
    [historyEntries],
  )
  const hasCorrections = useMemo(
    () =>
      Boolean(historyEntries?.some((entry) => entry.corrections.length > 0)),
    [historyEntries],
  )
  const hasVocabulary = useMemo(
    () => Boolean(historyEntries?.some((entry) => entry.vocabulary.length > 0)),
    [historyEntries],
  )

  useEffect(() => {
    if (historyTranscriptScrollRef.current) {
      historyTranscriptScrollRef.current.scrollTop =
        historyTranscriptScrollRef.current.scrollHeight
    }
    if (historyCorrectionsScrollRef.current) {
      historyCorrectionsScrollRef.current.scrollTop =
        historyCorrectionsScrollRef.current.scrollHeight
    }
    if (historyVocabularyScrollRef.current) {
      historyVocabularyScrollRef.current.scrollTop =
        historyVocabularyScrollRef.current.scrollHeight
    }
  }, [historyEntries, sessionId])

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = null
      }
    },
    [],
  )

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimeoutRef.current = null
    }, 1800)
  }, [])

  const copyMarkdown = useCallback(
    async (kind: 'transcript' | 'corrections' | 'vocabulary', text: string) => {
      if (!text) {
        return
      }
      try {
        await navigator.clipboard.writeText(text)
        const message =
          kind === 'transcript'
            ? 'Transcript copied.'
            : kind === 'vocabulary'
              ? 'Vocabulary copied.'
              : 'Corrections copied.'
        showToast(message)
      } catch (err) {
        console.error('Failed to copy', err)
      }
    },
    [showToast],
  )

  if (historyEntries === undefined) {
    return <PageSpinner />
  }

  return (
    <AppSurface>
      <AppPageContainer className="min-h-screen gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
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
                Session history
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={APP_NEUTRAL_BADGE_CLASS}>
              90 days
            </Badge>
            <AccountMenu />
          </div>
        </header>

        <main className="flex flex-1">
          <Card
            className={cn('relative flex flex-1 flex-col', APP_PANEL_CLASS)}
          >
            {toastMessage ? (
              <div
                className={cn(
                  'pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.12)]',
                  APP_PANEL_CLASS,
                )}
                role="status"
              >
                {toastMessage}
              </div>
            ) : null}
            <CardHeader className="space-y-2">
              <div
                className={cn('flex items-center gap-2', APP_BRAND_TEXT_CLASS)}
              >
                <History className="size-4" />
                <CardTitle className="text-base">Transcript history</CardTitle>
              </div>
              <CardDescription className={APP_TEXT_MUTED_CLASS}>
                {session
                  ? `${session.targetLanguage} | ${formatSessionTimestamp(
                      session.createdAt,
                    )}`
                  : 'Session transcript'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              {historyEntries.length > 0 ? (
                <div className="grid min-h-0 gap-4 lg:grid-cols-3">
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          'text-xs font-semibold uppercase tracking-[0.3em]',
                          APP_TEXT_LABEL_CLASS,
                        )}
                      >
                        Transcript
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy transcript"
                        title="Copy transcript"
                        onClick={() =>
                          void copyMarkdown('transcript', transcriptMarkdown)
                        }
                        disabled={!transcriptMarkdown}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <div
                      ref={historyTranscriptScrollRef}
                      className={cn('flex-1 space-y-3 overflow-y-auto pr-2')}
                    >
                      {historyEntries.map((entry) => (
                        <div
                          key={entry.transcript._id}
                          className={cn(
                            'rounded-xl border p-3',
                            APP_PANEL_SOFT_CLASS,
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em]',
                              APP_TEXT_LABEL_CLASS,
                            )}
                          >
                            <span>
                              {formatSessionTimestamp(entry.createdAt)}
                            </span>
                            <span>
                              {formatEventSpeaker(entry.transcript.speaker)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">
                            {entry.transcript.text}
                          </p>
                          {entry.transcript.translatedText ? (
                            <p
                              className={cn(
                                'mt-1 text-xs',
                                APP_TEXT_MUTED_CLASS,
                              )}
                            >
                              {entry.transcript.translatedText}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          'text-xs font-semibold uppercase tracking-[0.3em]',
                          APP_TEXT_LABEL_CLASS,
                        )}
                      >
                        Corrections
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy corrections"
                        title="Copy corrections"
                        onClick={() =>
                          void copyMarkdown('corrections', correctionsMarkdown)
                        }
                        disabled={!hasCorrections || !correctionsMarkdown}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <div
                      ref={historyCorrectionsScrollRef}
                      className={cn('flex-1 space-y-3 overflow-y-auto pr-2')}
                    >
                      {historyEntries
                        .filter((entry) => entry.corrections.length > 0)
                        .map((entry) => (
                          <div
                            key={`corrections-${entry.transcript._id}`}
                            className={cn(
                              'rounded-xl border p-3',
                              APP_PANEL_SOFT_CLASS,
                            )}
                          >
                            <div
                              className={cn(
                                'flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em]',
                                APP_TEXT_LABEL_CLASS,
                              )}
                            >
                              <span>
                                {formatSessionTimestamp(entry.createdAt)}
                              </span>
                              <span>
                                {entry.corrections.length} note
                                {entry.corrections.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-2">
                              {entry.corrections.map((note) => {
                                const isGood = note.severity === 'positive'
                                return (
                                  <div
                                    key={note._id}
                                    className="flex items-start gap-2"
                                  >
                                    <span
                                      className={cn(
                                        'mt-0.5 rounded-full p-1',
                                        isGood
                                          ? APP_GOOD_NOTE_CLASS
                                          : APP_FIX_NOTE_CLASS,
                                      )}
                                    >
                                      {isGood ? (
                                        <Check className="size-3" />
                                      ) : (
                                        <AlertTriangle className="size-3" />
                                      )}
                                    </span>
                                    <div>
                                      <p className="text-sm font-semibold">
                                        {note.title}
                                      </p>
                                      <p
                                        className={cn(
                                          'text-xs',
                                          APP_TEXT_MUTED_CLASS,
                                        )}
                                      >
                                        {note.detail}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          'text-xs font-semibold uppercase tracking-[0.3em]',
                          APP_TEXT_LABEL_CLASS,
                        )}
                      >
                        Vocabulary
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy vocabulary"
                        title="Copy vocabulary"
                        onClick={() =>
                          void copyMarkdown('vocabulary', vocabularyMarkdown)
                        }
                        disabled={!hasVocabulary || !vocabularyMarkdown}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <div
                      ref={historyVocabularyScrollRef}
                      className={cn('flex-1 space-y-3 overflow-y-auto pr-2')}
                    >
                      {historyEntries
                        .filter((entry) => entry.vocabulary.length > 0)
                        .map((entry) => (
                          <div
                            key={`vocabulary-${entry.transcript._id}`}
                            className={cn(
                              'rounded-xl border p-3',
                              APP_PANEL_SOFT_CLASS,
                            )}
                          >
                            <div
                              className={cn(
                                'flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em]',
                                APP_TEXT_LABEL_CLASS,
                              )}
                            >
                              <span>
                                {formatSessionTimestamp(entry.createdAt)}
                              </span>
                              <span>
                                {entry.vocabulary.length} word
                                {entry.vocabulary.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-2">
                              {entry.vocabulary.map((note) => (
                                <div key={note._id}>
                                  <p className="text-sm font-semibold">
                                    {note.word}
                                  </p>
                                  <p
                                    className={cn(
                                      'text-xs',
                                      APP_TEXT_MUTED_CLASS,
                                    )}
                                  >
                                    {note.definition}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyTranscriptFallback.map((line, index) => (
                    <div
                      key={`${line.text}-${index}`}
                      className={cn('rounded-xl p-3', APP_SAND_SOFT_CLASS)}
                    >
                      <p
                        className={cn(
                          'text-xs font-semibold uppercase tracking-[0.3em]',
                          APP_TEXT_LABEL_STRONG_CLASS,
                        )}
                      >
                        {line.speaker}
                      </p>
                      <p className="text-sm">{line.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </AppPageContainer>
    </AppSurface>
  )
}
