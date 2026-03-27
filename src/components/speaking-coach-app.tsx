import {
  AudioLines,
  AudioWaveform,
  Languages,
  MessageCircle,
  Mic,
  MicOff,
  Sparkles,
  X,
} from 'lucide-react'
import type { TranslationMode } from '@/lib/translation-preferences'
import type {
  InsightsMode,
  SpeakingCoachControllerState,
} from '@/lib/use-speaking-coach-controller'
import { AccountMenu } from '@/components/account-menu'
import { AppPageContainer, AppSurface } from '@/components/app-surface'
import { AudioDeviceSelectors } from '@/components/speaking-coach/audio-device-selectors'
import { AudioPermissionBanner } from '@/components/speaking-coach/audio-permission-banner'
import { CoachTranscript } from '@/components/coach-transcript'
import { ErrorBanner } from '@/components/error-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSpeakingCoachController } from '@/lib/use-speaking-coach-controller'
import { languageOptions } from '@/lib/speaking-coach-languages'
import { formatDuration } from '@/lib/speaking-coach-utils'
import { cn } from '@/lib/utils'

const LIVE_FEED_MAX_HEIGHT = 'max-h-[520px]'

const liveVocabularyFallback = [
  {
    word: 'Vocabulary',
    definition: 'New words will appear as you speak.',
  },
]

const translationModeItems: Array<{ value: TranslationMode; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
  { value: 'hover', label: 'Hover reveal' },
]

const getTranslationModeLabel = (mode: TranslationMode) =>
  translationModeItems.find((item) => item.value === mode)?.label ?? mode

type TranslationModeControlProps = {
  label: string
  value: TranslationMode
  onChange: (mode: TranslationMode) => void
}

const TranslationModeControl = ({
  label,
  value,
  onChange,
}: TranslationModeControlProps) => (
  <div className="grid min-w-0 gap-1 sm:min-w-40">
    <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
      {label}
    </p>
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (
          nextValue === 'off' ||
          nextValue === 'on' ||
          nextValue === 'hover'
        ) {
          onChange(nextValue)
        }
      }}
    >
      <SelectTrigger className="h-8 w-full border-input bg-card/90 px-2.5 py-1.5 text-xs">
        <Languages className="size-3.5 text-muted-foreground" />
        <SelectValue>{getTranslationModeLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {translationModeItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)

type InsightsPanelProps = {
  mode: InsightsMode
  onModeChange: (mode: InsightsMode) => void
  onClose?: () => void
  showCorrections: boolean
  showVocabulary: boolean
  correctionsList: Array<{
    type: 'fix' | 'good'
    title: string
    detail: string
  }>
  vocabularyList: Array<{ word: string; definition: string }>
  correctionsScrollRef: React.MutableRefObject<HTMLDivElement | null>
  vocabularyScrollRef: React.MutableRefObject<HTMLDivElement | null>
}

const InsightsPanel = ({
  mode,
  onModeChange,
  onClose,
  showCorrections,
  showVocabulary,
  correctionsList,
  vocabularyList,
  correctionsScrollRef,
  vocabularyScrollRef,
}: InsightsPanelProps) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
        <Sparkles className="size-3.5" />
        Insights
      </div>
      <div className="flex items-center gap-2">
        <div
          data-slot="button-group"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1"
        >
          <Button
            type="button"
            size="xs"
            variant={mode === 'corrections' ? 'secondary' : 'outline'}
            aria-pressed={mode === 'corrections'}
            onClick={() => onModeChange('corrections')}
          >
            Corrections
          </Button>
          <Button
            type="button"
            size="xs"
            variant={mode === 'vocabulary' ? 'secondary' : 'outline'}
            aria-pressed={mode === 'vocabulary'}
            onClick={() => onModeChange('vocabulary')}
          >
            Vocab
          </Button>
          <Button
            type="button"
            size="xs"
            variant={mode === 'both' ? 'secondary' : 'outline'}
            aria-pressed={mode === 'both'}
            onClick={() => onModeChange('both')}
          >
            Both
          </Button>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Hide insights"
            title="Hide insights"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>

    {showCorrections ? (
      <div className="grid gap-3 rounded-2xl border border-white/5 bg-[#0d1117]/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          <Sparkles className="size-3.5" />
          Live corrections
        </div>
        <div
          ref={correctionsScrollRef}
          className={cn(LIVE_FEED_MAX_HEIGHT, 'overflow-y-auto pr-2')}
        >
          <div className="space-y-2">
            {correctionsList.map((note, index) => (
              <div
                key={`${note.title}-${index}`}
                className={cn(
                  'rounded-xl px-3 py-2.5',
                  note.type === 'good'
                    ? 'bg-[#1d6c63]/15 text-[#7ec7bf]'
                    : 'bg-[#f08b5d]/10 text-[#f08b5d]',
                )}
              >
                <p className="text-xs font-semibold">
                  <span className="mr-1.5 font-bold">
                    {note.type === 'good' ? '✓' : '→'}
                  </span>
                  {note.title}
                </p>
                <p className="mt-0.5 text-[11px] opacity-60">{note.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null}

    {showVocabulary ? (
      <div className="grid gap-3 rounded-2xl border border-white/5 bg-[#0d1117]/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          <MessageCircle className="size-3.5" />
          Vocabulary
        </div>
        <div
          ref={vocabularyScrollRef}
          className={cn(LIVE_FEED_MAX_HEIGHT, 'overflow-y-auto pr-2')}
        >
          <div className="space-y-2">
            {(vocabularyList.length > 0
              ? vocabularyList
              : liveVocabularyFallback
            ).map((note, index) => (
              <div
                key={`${note.word}-${index}`}
                className="rounded-xl bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-white/90">
                  {note.word}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {note.definition}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null}
  </div>
)

export type SpeakingCoachAppProps = {
  controller: SpeakingCoachControllerState
  headerActions?: React.ReactNode
}

export function SpeakingCoachApp() {
  const controller = useSpeakingCoachController()
  return <SpeakingCoachAppView controller={controller} />
}

export function SpeakingCoachAppView({
  controller,
  headerActions,
}: SpeakingCoachAppProps) {
  const {
    preferences,
    conversationModeItems,
    activeLanguage,
    audioCatalog,
    audioInputDevices,
    hasAudioInputs,
    coachSession,
    dualModeNeedsTeacherSource,
    teacherSourceCapabilities,
    canCaptureDisplayAudio,
    isSessionStartDisabled,
    isHydratingLanguagePreference,
    handleLanguageChange,
    setTranslationMode,
    transcriptScrollRef,
    correctionsScrollRef,
    vocabularyScrollRef,
    insightsMode,
    setInsightsMode,
    isInsightsVisible,
    setInsightsVisible,
    isInsightsSheetOpen,
    setInsightsSheetOpen,
    showCorrections,
    showVocabulary,
  } = controller

  const {
    conversationMode,
    handleConversationModeChange,
    learnerDeviceId,
    teacherDeviceId,
    teacherInputSourceMethod,
    setLearnerDeviceId,
    setTeacherDeviceId,
    setTeacherInputSourceMethod,
  } = preferences

  const {
    session,
    transcriptEvents,
    transcriptLines,
    correctionsList,
    vocabularyList,
    translations,
    translationPreferences,
    coachStreamUrl,
    handleStreamComplete,
    handleStreamSegment,
    handleStreamDelta,
    handlePrimaryClick,
    statusLabel,
    isBusy,
    isActive,
    isLimitReached,
    usedMs,
  } = coachSession

  const languageMenu = (
    <div className="grid gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Language
      </p>
      <Select
        value={activeLanguage.id}
        onValueChange={handleLanguageChange}
        disabled={isBusy || isActive || isHydratingLanguagePreference}
      >
        <SelectTrigger className="w-full border-input bg-card/75 px-3 py-2">
          <Languages className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover">
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
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_28px_rgba(29,108,99,0.3)]">
              <AudioLines className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                GlotCap
              </p>
              <p className="text-sm text-muted-foreground">
                Live session workspace
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-primary text-white hover:bg-primary/80 hover:text-primary-foreground"
              onClick={handlePrimaryClick}
              disabled={isSessionStartDisabled}
            >
              {isActive ? (
                <MicOff data-icon="inline-start" />
              ) : (
                <Mic data-icon="inline-start" />
              )}
              {isActive
                ? 'Stop session'
                : conversationMode === 'dual_stream'
                  ? 'Start dual stream'
                  : 'Start talking'}
            </Button>
            {headerActions ?? <AccountMenu extraContent={languageMenu} />}
          </div>
        </header>

        <main className="flex flex-col gap-6">
          {session.error ? (
            <ErrorBanner
              message={session.error}
              actionLabel={session.canResume ? 'Resume' : 'Dismiss'}
              onAction={session.canResume ? session.resume : session.reset}
            />
          ) : null}

          <div
            className={cn(
              'grid gap-6',
              isInsightsVisible
                ? 'xl:grid-cols-[minmax(0,1fr)_360px]'
                : 'xl:grid-cols-1',
            )}
          >
            <Card className="border-white/10 bg-[#0d1117]/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isActive ? 'bg-[#f08b5d] animate-pulse' : 'bg-white/20',
                      )}
                    />
                    <CardTitle className="text-base">Live session</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-primary/40 text-primary"
                    >
                      {activeLanguage.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-input text-foreground"
                    >
                      {conversationMode === 'dual_stream'
                        ? 'Teacher capture'
                        : 'AI coach'}
                    </Badge>
                    {session.canResume ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/50 text-destructive"
                      >
                        Paused
                      </Badge>
                    ) : null}
                    {isInsightsVisible ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="lg:hidden"
                        onClick={() => setInsightsSheetOpen(true)}
                      >
                        <Sparkles className="size-3.5" />
                        Insights
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInsightsVisible(true)}
                      >
                        <Sparkles className="size-3.5" />
                        Show insights
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription className="text-white/40">
                  {statusLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="grid gap-3 2xl:grid-cols-3">
                    <div className="grid gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        Session mode
                      </p>
                      <Select
                        value={conversationMode}
                        onValueChange={handleConversationModeChange}
                        items={conversationModeItems}
                        disabled={isBusy || isActive}
                      >
                        <SelectTrigger className="w-full border-input bg-card/75 px-3 py-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="coach">AI coach</SelectItem>
                          <SelectItem value="dual_stream">
                            Teacher call capture
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="2xl:col-span-2">
                      <AudioDeviceSelectors
                        conversationMode={conversationMode}
                        audioInputDevices={audioInputDevices}
                        learnerDeviceId={learnerDeviceId}
                        teacherDeviceId={teacherDeviceId}
                        teacherInputSourceMethod={teacherInputSourceMethod}
                        canCaptureDisplayAudio={canCaptureDisplayAudio}
                        onLearnerDeviceChange={setLearnerDeviceId}
                        onTeacherDeviceChange={setTeacherDeviceId}
                        onTeacherInputSourceMethodChange={
                          setTeacherInputSourceMethod
                        }
                        disabled={isBusy || isActive}
                      />
                    </div>
                  </div>
                  <AudioPermissionBanner
                    isSupported={audioCatalog.isSupported}
                    permissionState={audioCatalog.permissionState}
                    errorMessage={audioCatalog.errorMessage}
                    isBusy={isBusy}
                    isActive={isActive}
                    onRequestPermission={() =>
                      void audioCatalog.requestPermission()
                    }
                  />
                  {!hasAudioInputs ? (
                    <p className="text-xs text-muted-foreground">
                      No audio input devices detected. Connect your mic or
                      monitor source and refresh the page.
                    </p>
                  ) : null}
                  {dualModeNeedsTeacherSource ? (
                    <p className="text-xs text-destructive">
                      Select a teacher audio source to start dual-stream mode.
                    </p>
                  ) : null}
                  {conversationMode === 'dual_stream' &&
                  teacherInputSourceMethod === 'display' &&
                  !canCaptureDisplayAudio ? (
                    <p className="text-xs text-destructive">
                      Screen share audio capture is not available in{' '}
                      {teacherSourceCapabilities.browserFamily === 'firefox'
                        ? 'Firefox'
                        : 'this browser'}
                      . Use Audio input device instead.
                    </p>
                  ) : null}
                  {conversationMode === 'dual_stream' &&
                  teacherInputSourceMethod === 'display' &&
                  canCaptureDisplayAudio ? (
                    <p className="text-xs text-muted-foreground">
                      We will prompt you to choose a tab/window/screen with
                      audio when the session starts.
                    </p>
                  ) : null}
                  {session.canResume ? (
                    <p className="text-xs text-destructive">
                      Session paused. Reconnect your devices and press Resume.
                    </p>
                  ) : null}
                  {session.transcriptionNotice ? (
                    <p className="text-xs text-amber-700">
                      {session.transcriptionNotice}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                    <span className="rounded-full bg-primary/15 p-2 text-primary">
                      <AudioWaveform />
                    </span>
                    <div className="flex flex-1 items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                          {isActive ? 'Listening' : 'Ready'}
                        </p>
                        <p className="text-sm font-semibold">
                          {isLimitReached
                            ? 'Limit reached'
                            : session.isSupported
                              ? conversationMode === 'dual_stream'
                                ? 'Dual stream ready'
                                : 'Coach ready'
                              : 'Audio not supported'}
                        </p>
                      </div>
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                        {isActive ? <MicOff /> : <Mic />}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <div
                      className="flex flex-1 items-end gap-1"
                      aria-hidden="true"
                    >
                      {[14, 26, 20, 36, 18, 30, 22, 34, 16, 28].map(
                        (height, index) => (
                          <span
                            key={height}
                            className={cn(
                              'w-1.5 rounded-full bg-primary/70',
                              isActive ? 'glotcap-wave' : 'opacity-40',
                            )}
                            style={{
                              height: `${height}px`,
                              animationDelay: `${index * 0.12}s`,
                            }}
                          />
                        ),
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        Session
                      </p>
                      <p className="text-sm font-semibold">
                        {formatDuration(usedMs)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-white/5 bg-[#0d1117]/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                      <MessageCircle className="size-3.5" />
                      Live transcript
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TranslationModeControl
                        label={
                          conversationMode === 'dual_stream'
                            ? 'Teacher Translation'
                            : 'Coach Translation'
                        }
                        value={translationPreferences.counterpart}
                        onChange={(mode) => {
                          setTranslationMode('counterpart', mode)
                        }}
                      />
                      <TranslationModeControl
                        label="Your Translation"
                        value={translationPreferences.self}
                        onChange={(mode) => {
                          setTranslationMode('self', mode)
                        }}
                      />
                    </div>
                  </div>
                  <div
                    ref={transcriptScrollRef}
                    className={cn(
                      LIVE_FEED_MAX_HEIGHT,
                      'min-h-0 flex-1 overflow-y-auto pr-2 xl:max-h-none',
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
              </CardContent>
            </Card>

            {isInsightsVisible ? (
              <aside className="hidden flex-col gap-4 lg:flex">
                <InsightsPanel
                  mode={insightsMode}
                  onModeChange={setInsightsMode}
                  onClose={() => setInsightsVisible(false)}
                  showCorrections={showCorrections}
                  showVocabulary={showVocabulary}
                  correctionsList={correctionsList}
                  vocabularyList={vocabularyList}
                  correctionsScrollRef={correctionsScrollRef}
                  vocabularyScrollRef={vocabularyScrollRef}
                />
              </aside>
            ) : null}
          </div>
        </main>
      </AppPageContainer>

      {isInsightsSheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <button
            type="button"
            aria-label="Close insights"
            className="absolute inset-0 bg-black/55"
            onClick={() => setInsightsSheetOpen(false)}
          />
          <div className="relative w-full rounded-t-3xl border border-white/10 bg-[#0d1117]/95 px-4 pb-6 pt-4 shadow-[0_-18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/20" />
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <InsightsPanel
                mode={insightsMode}
                onModeChange={setInsightsMode}
                onClose={() => setInsightsSheetOpen(false)}
                showCorrections={showCorrections}
                showVocabulary={showVocabulary}
                correctionsList={correctionsList}
                vocabularyList={vocabularyList}
                correctionsScrollRef={correctionsScrollRef}
                vocabularyScrollRef={vocabularyScrollRef}
              />
            </div>
          </div>
        </div>
      ) : null}
    </AppSurface>
  )
}
