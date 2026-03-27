import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import {
  AlertTriangle,
  AudioWaveform,
  Check,
  Languages,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  Sparkles,
  Timer,
  Volume2,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type {
  CoachCorrectionNote,
  CoachTranscriptLine,
} from '@/lib/speaking-coach-session'
import type {
  TranslationMode,
  TranslationRole,
} from '@/lib/translation-preferences'
import type { AuthDialogView } from '@/components/auth/auth-dialog'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ErrorBanner } from '@/components/error-banner'
import { CoachTranscript } from '@/components/coach-transcript'
import { WaitlistDialog } from '@/components/waitlist-dialog'
import { useFollowScroll } from '@/lib/use-follow-scroll'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSpeakingCoachSession } from '@/lib/speaking-coach-session'
import { languageOptions } from '@/lib/speaking-coach-languages'
import { formatDuration } from '@/lib/speaking-coach-utils'

// Legacy style sandbox kept intentionally for side-by-side experimentation.
// Production surfaces should use semantic contracts from `@/theme/semantic`.
const waveformHeights = [14, 26, 20, 36, 18, 30, 22, 34, 16, 28]

const demoTranscript: Array<CoachTranscriptLine> = [
  {
    speaker: 'You',
    text: 'Je suis alle au magasin hier.',
  },
  {
    speaker: 'Coach',
    text: 'Nice. What did you buy?',
  },
  {
    speaker: 'You',
    text: 'Du pain et des fraises.',
  },
]

const demoCorrections: Array<CoachCorrectionNote> = [
  {
    type: 'fix',
    title: 'Gender agreement',
    detail: 'alle should match feminine speaker -> allee',
  },
  {
    type: 'good',
    title: 'Past tense',
    detail: 'Good passe compose for aller.',
  },
  {
    type: 'fix',
    title: 'Pronunciation',
    detail: 'Round the "u" in du, keep it short.',
  },
]

const demoHighlights = [
  {
    title: 'Inline corrections',
    description: 'Notes appear without interrupting the flow.',
    icon: Sparkles,
  },
  {
    title: 'Coach voice',
    description: 'Natural pacing with quick follow-ups.',
    icon: Volume2,
  },
  {
    title: 'Instant replay',
    description: 'Tap a line to hear it again.',
    icon: MessageCircle,
  },
  {
    title: 'CEFR path',
    description: 'A1 to C1 sessions curated by level.',
    icon: AudioWaveform,
  },
]

const DEFAULT_TTS_OUTPUT_FORMAT = 'mp3_22050_32'
const DEFAULT_TTS_LATENCY_HINT = 3
const LIVE_FEED_MAX_HEIGHT = 'max-h-[640px]'
const LANGUAGE_STORAGE_KEY = 'glotcap-demo-language'
const translationModeItems: Array<{ value: TranslationMode; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
  { value: 'hover', label: 'Hover reveal' },
]

const getTranslationModeLabel = (mode: TranslationMode) =>
  translationModeItems.find((item) => item.value === mode)?.label ?? mode

export function ComponentExample() {
  return <SpeakingCoachDemo />
}

function SpeakingCoachDemo() {
  const [activeModal, setActiveModal] = useState<
    'waitlist' | AuthDialogView | null
  >(null)
  const [inviteParam, setInviteParam] = useState<string | null>(null)
  const [languageId, setLanguageId] = useState(() => {
    if (typeof window === 'undefined') {
      return 'fr'
    }
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored && languageOptions.some((option) => option.id === stored)) {
      return stored
    }
    return 'fr'
  })
  const handleLanguageChange = useCallback((value: string | null) => {
    if (value) {
      setLanguageId(value)
    }
  }, [])
  const openWaitlist = useCallback(() => {
    setInviteParam(null)
    setActiveModal('waitlist')
  }, [])
  const openLogin = useCallback(() => {
    setInviteParam(null)
    setActiveModal('login')
  }, [])
  const openSignup = useCallback((invite?: string | null) => {
    setInviteParam(invite ?? null)
    setActiveModal('signup')
  }, [])
  const activeLanguage = useMemo(
    () =>
      languageOptions.find((option) => option.id === languageId) ??
      languageOptions[0],
    [languageId],
  )
  const demoLimit = useQuery(api.speaking.getDemoLimit)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageId)
    } catch {
      // Ignore storage errors (private mode, quota).
    }
  }, [languageId])
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    const auth = params.get('auth')

    if (invite) {
      openSignup(invite)
      return
    }

    if (auth === 'confirmed') {
      setActiveModal('confirmed')
      return
    }

    if (auth === 'login') {
      setActiveModal('login')
      return
    }

    if (auth === 'signup') {
      setActiveModal('signup')
      return
    }

    if (auth === 'waitlist') {
      setActiveModal('waitlist')
    }
  }, [openSignup])
  const sourceLanguage = 'English'
  const {
    session,
    transcriptEvents,
    transcriptLines,
    correctionsList,
    translations,
    translationPreferences,
    setTranslationPreferences,
    coachStreamUrl,
    handleStreamComplete,
    handleStreamSegment,
    handleStreamDelta,
    handlePrimaryClick,
    statusLabel,
    isBusy,
    isActive,
    isLimitReached,
    isStartDisabled,
    usedMs,
    displayLimitMs,
    remainingMs,
    progressPct,
  } = useSpeakingCoachSession({
    sessionOptions: {
      mode: 'demo',
      targetLanguage: activeLanguage.targetLanguage,
      sourceLanguage,
      sttLanguage: activeLanguage.sttLanguage,
      ttsLanguageCode: activeLanguage.ttsLanguageCode,
      ttsOutputFormat: DEFAULT_TTS_OUTPUT_FORMAT,
      ttsLatencyHint: DEFAULT_TTS_LATENCY_HINT,
    },
    translationTargetLanguage: sourceLanguage,
    fallbackTranscript: demoTranscript,
    fallbackCorrections: demoCorrections,
    limitReachedLabel: 'Demo limit reached',
    displayLimitMsOverride: demoLimit?.limitMs,
  })
  const isDemoLimitLoading = demoLimit === undefined
  const isDemoLimitDisabled = !isDemoLimitLoading && displayLimitMs <= 0
  const { ref: transcriptScrollRef } = useFollowScroll({
    deps: [transcriptEvents, translationPreferences, translations],
  })
  const { ref: correctionsScrollRef } = useFollowScroll({
    deps: [correctionsList],
  })

  const setTranslationMode = useCallback(
    (role: TranslationRole, mode: TranslationMode) => {
      setTranslationPreferences((prev) => {
        if (prev[role] === mode) {
          return prev
        }
        return {
          ...prev,
          [role]: mode,
        }
      })
    },
    [setTranslationPreferences],
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--glotcap-sand)] text-[color:var(--glotcap-ink)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--glotcap-sky)_0,_transparent_65%)] opacity-40" />
      <div className="pointer-events-none absolute -top-40 right-[-8%] h-80 w-80 rounded-full bg-[color:var(--glotcap-coral)]/25 blur-3xl glotcap-float" />
      <div className="pointer-events-none absolute -bottom-52 left-[-12%] h-[28rem] w-[28rem] rounded-full bg-[color:var(--glotcap-mint)]/70 blur-3xl glotcap-float glotcap-delay-2" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--glotcap-teal)] text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,108,99,0.3)]">
              GC
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--glotcap-teal)]">
                GlotCap
              </p>
              <p className="text-sm text-[color:var(--glotcap-ink)]/70">
                Live speaking coach demo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'bg-white/70',
              )}
              onClick={openLogin}
            >
              Sign in
            </button>
            <Button
              variant="outline"
              className="bg-white/70"
              onClick={openWaitlist}
            >
              Join the wait list
            </Button>
          </div>
        </header>

        <main className="grid items-start gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <section className="flex flex-col gap-6 glotcap-fade-up">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[color:var(--glotcap-teal)] text-white">
                Try the coach now
              </Badge>
              <Badge
                variant="secondary"
                className="bg-white/70 text-[color:var(--glotcap-ink)]"
              >
                5-minute free session
              </Badge>
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
                Meet your live speaking coach. Talk now, decide later.
              </h1>
              <p className="text-base text-[color:var(--glotcap-ink)]/75 md:text-lg">
                Start a real conversation in seconds. We stream corrections to a
                side feed so you can keep speaking while the coach adapts to
                your pace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-[color:var(--glotcap-teal)] text-white hover:bg-[color:var(--glotcap-sky)] hover:text-[color:var(--glotcap-bg-deep)]"
                onClick={handlePrimaryClick}
                disabled={isStartDisabled}
              >
                {isActive ? (
                  <MicOff data-icon="inline-start" />
                ) : (
                  <Mic data-icon="inline-start" />
                )}
                {isActive ? 'Stop session' : 'Start talking'}
              </Button>
              <Select
                value={activeLanguage.id}
                onValueChange={handleLanguageChange}
                disabled={isBusy || isActive}
              >
                <SelectTrigger className="border-[color:var(--glotcap-ink)]/15 bg-white/70 px-3 py-2">
                  <Languages className="size-4 text-[color:var(--glotcap-ink)]/60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95">
                  {languageOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {session.error ? (
              <ErrorBanner message={session.error} onAction={session.reset} />
            ) : null}
            <div className="grid gap-3">
              {demoHighlights.map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-[color:var(--glotcap-ink)]/10 bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--glotcap-mint)] text-[color:var(--glotcap-teal)]">
                        <Icon />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-[color:var(--glotcap-ink)]/70">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="grid gap-4 glotcap-fade-up glotcap-delay-2">
            <Card className="border-[color:var(--glotcap-ink)]/10 bg-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isActive
                          ? 'bg-[color:var(--glotcap-coral)] animate-pulse'
                          : 'bg-[color:var(--glotcap-ink)]/30',
                      )}
                    />
                    <CardTitle className="text-base">Live session</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-[color:var(--glotcap-teal)]/30 text-[color:var(--glotcap-teal)]"
                  >
                    A2 to B1
                  </Badge>
                </div>
                <CardDescription className="text-[color:var(--glotcap-ink)]/70">
                  {statusLabel}
                </CardDescription>
                <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--glotcap-ink)]/10 bg-[color:var(--glotcap-sand)]/60 p-3">
                  <span className="rounded-full bg-[color:var(--glotcap-teal)]/10 p-2 text-[color:var(--glotcap-teal)]">
                    <AudioWaveform />
                  </span>
                  <div className="flex flex-1 items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--glotcap-ink)]/60">
                        {isActive ? 'Listening' : 'Ready'}
                      </p>
                      <p className="text-sm font-semibold">
                        {isLimitReached
                          ? 'Limit reached'
                          : session.isSupported
                            ? 'Coach ready'
                            : 'Audio not supported'}
                      </p>
                    </div>
                    <Button
                      size="icon-lg"
                      className="rounded-full bg-[color:var(--glotcap-teal)] text-white shadow-[0_12px_28px_rgba(29,108,99,0.3)] hover:bg-[color:var(--glotcap-sky)] hover:text-[color:var(--glotcap-bg-deep)]"
                      onClick={handlePrimaryClick}
                      disabled={isStartDisabled}
                    >
                      {isActive ? <MicOff /> : <Mic />}
                      <span className="sr-only">
                        {isActive ? 'Stop session' : 'Start talking'}
                      </span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--glotcap-ink)]/10 bg-white/80 p-4">
                  <div
                    className="flex flex-1 items-end gap-1"
                    aria-hidden="true"
                  >
                    {waveformHeights.map((height, index) => (
                      <span
                        key={height}
                        className={cn(
                          'w-1.5 rounded-full bg-[color:var(--glotcap-teal)]/70',
                          isActive ? 'glotcap-wave' : 'opacity-40',
                        )}
                        style={{
                          height: `${height}px`,
                          animationDelay: `${index * 0.12}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--glotcap-ink)]/50">
                      Session
                    </p>
                    <p className="text-sm font-semibold">
                      {formatDuration(usedMs)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                  <div className="grid gap-3 rounded-2xl border border-[color:var(--glotcap-ink)]/10 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--glotcap-ink)]/60">
                        <MessageCircle className="size-4" />
                        Live transcript
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="grid min-w-36 gap-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:var(--glotcap-ink)]/50">
                            Coach Translation
                          </p>
                          <Select
                            value={translationPreferences.counterpart}
                            onValueChange={(nextValue) => {
                              if (
                                nextValue === 'off' ||
                                nextValue === 'on' ||
                                nextValue === 'hover'
                              ) {
                                setTranslationMode('counterpart', nextValue)
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-full border-[color:var(--glotcap-ink)]/15 bg-white/80 px-2.5 py-1.5 text-xs">
                              <Languages className="size-3.5 text-[color:var(--glotcap-ink)]/60" />
                              <SelectValue>
                                {getTranslationModeLabel(
                                  translationPreferences.counterpart,
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-white/95">
                              {translationModeItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid min-w-36 gap-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:var(--glotcap-ink)]/50">
                            Your Translation
                          </p>
                          <Select
                            value={translationPreferences.self}
                            onValueChange={(nextValue) => {
                              if (
                                nextValue === 'off' ||
                                nextValue === 'on' ||
                                nextValue === 'hover'
                              ) {
                                setTranslationMode('self', nextValue)
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-full border-[color:var(--glotcap-ink)]/15 bg-white/80 px-2.5 py-1.5 text-xs">
                              <Languages className="size-3.5 text-[color:var(--glotcap-ink)]/60" />
                              <SelectValue>
                                {getTranslationModeLabel(
                                  translationPreferences.self,
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-white/95">
                              {translationModeItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div
                      ref={transcriptScrollRef}
                      className={cn(
                        LIVE_FEED_MAX_HEIGHT,
                        'overflow-y-auto pr-2 lg:max-h-none',
                      )}
                    >
                      <CoachTranscript
                        events={transcriptEvents}
                        fallbackLines={transcriptLines}
                        streamUrl={coachStreamUrl}
                        activeStreamId={session.activeCoachStreamId}
                        translations={translations}
                        translationPreferences={translationPreferences}
                        onStreamComplete={handleStreamComplete}
                        onStreamSegment={handleStreamSegment}
                        onStreamDelta={handleStreamDelta}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid gap-3 rounded-2xl border border-[color:var(--glotcap-ink)]/10 bg-white/80 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--glotcap-ink)]/60">
                        <Sparkles className="size-4" />
                        Corrections feed
                      </div>
                      <div
                        ref={correctionsScrollRef}
                        className={cn(
                          LIVE_FEED_MAX_HEIGHT,
                          'overflow-y-auto pr-2',
                        )}
                      >
                        <div className="space-y-2">
                          {correctionsList.map((note, index) => (
                            <div
                              key={`${note.title}-${index}`}
                              className="flex items-start gap-3 rounded-xl bg-[color:var(--glotcap-sand)]/70 p-3"
                            >
                              <span
                                className={cn(
                                  'mt-0.5 rounded-full p-1',
                                  note.type === 'good'
                                    ? 'bg-[color:var(--glotcap-mint)] text-[color:var(--glotcap-teal)]'
                                    : 'bg-[color:var(--glotcap-coral)]/20 text-[color:var(--glotcap-coral)]',
                                )}
                              >
                                {note.type === 'good' ? (
                                  <Check className="size-3" />
                                ) : (
                                  <AlertTriangle className="size-3" />
                                )}
                              </span>
                              <div>
                                <p className="text-sm font-semibold">
                                  {note.title}
                                </p>
                                <p className="text-xs text-[color:var(--glotcap-ink)]/70">
                                  {note.detail}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>

        <section className="mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-2 glotcap-fade-up glotcap-delay-3">
          <Card className="border-[color:var(--glotcap-ink)]/10 bg-white/75">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-[color:var(--glotcap-teal)]">
                <Timer className="size-4" />
                <CardTitle className="text-base">Demo limit</CardTitle>
              </div>
              <CardDescription className="text-[color:var(--glotcap-ink)]/70">
                {isDemoLimitLoading
                  ? 'Loading demo limit...'
                  : isDemoLimitDisabled
                    ? 'Demo limit is disabled.'
                    : `${formatDuration(usedMs)} used. ${formatDuration(remainingMs)} left before signup.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isDemoLimitLoading || isDemoLimitDisabled ? null : (
                <div className="h-2 w-full rounded-full bg-[color:var(--glotcap-ink)]/10">
                  <div
                    className="h-2 rounded-full bg-[color:var(--glotcap-coral)]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
              <Button
                variant="outline"
                className="w-full bg-white/80"
                onClick={openWaitlist}
              >
                Create an account
              </Button>
            </CardContent>
          </Card>
          <Card className="border-[color:var(--glotcap-ink)]/10 bg-white/75">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-[color:var(--glotcap-teal)]">
                <Lock className="size-4" />
                <CardTitle className="text-base">After the demo</CardTitle>
              </div>
              <CardDescription className="text-[color:var(--glotcap-ink)]/70">
                Sign up to save progress, unlock SRS, and longer sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full bg-white/80"
                onClick={openWaitlist}
              >
                Join the wait list
              </Button>
              <p className="text-xs text-[color:var(--glotcap-ink)]/60">
                No credit card required for the first week.
              </p>
            </CardContent>
          </Card>
        </section>
        <WaitlistDialog
          open={activeModal === 'waitlist'}
          onOpenChange={(open) => {
            setActiveModal(open ? 'waitlist' : null)
            if (!open) {
              setInviteParam(null)
            }
          }}
          onHaveCode={() => openSignup(null)}
        />
        {activeModal && activeModal !== 'waitlist' ? (
          <AuthDialog
            open
            view={activeModal}
            onOpenChange={(open) => {
              if (!open) {
                setActiveModal(null)
                setInviteParam(null)
              }
            }}
            onSwitchView={(view) => {
              setInviteParam(null)
              setActiveModal(view)
            }}
            onOpenWaitlist={openWaitlist}
            defaultInviteCode={inviteParam}
          />
        ) : null}
      </div>
    </div>
  )
}
