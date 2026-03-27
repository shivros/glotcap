import { Bot, User } from 'lucide-react'
import type {
  TranslationMode,
  TranslationPreferences,
} from '@/lib/translation-preferences'
import { sanitizeSpeechText } from '@/lib/speaking-session-text'
import { modeForSpeaker } from '@/lib/translation-preferences'
import { useCoachStream } from '@/lib/use-coach-stream'

export type TranscriptEvent = {
  _id: string
  speaker?: 'user' | 'teacher' | 'coach' | 'system'
  text?: string
  streamId?: string
}

type TranscriptFallbackLine = {
  speaker: string
  text: string
}

type CoachTranscriptProps = {
  events: Array<TranscriptEvent> | null
  fallbackLines: Array<TranscriptFallbackLine>
  streamUrl: URL
  activeStreamId?: string | null
  translations?: Record<string, string>
  translationPreferences: TranslationPreferences
  onStreamComplete: (streamId: string, text: string, status: string) => void
  onStreamSegment: (streamId: string, segment: string, isFinal: boolean) => void
  onStreamDelta?: (streamId: string, delta: string) => void
}

const formatSpeaker = (speaker?: TranscriptEvent['speaker']) => {
  if (speaker === 'user') {
    return 'You'
  }
  if (speaker === 'coach') {
    return 'Coach'
  }
  if (speaker === 'teacher') {
    return 'Teacher'
  }
  return 'System'
}

const TranslationLine = ({
  text,
  mode,
}: {
  text: string
  mode: TranslationMode
}) => {
  const cleaned = sanitizeSpeechText(text)
  if (!cleaned || mode === 'off') {
    return null
  }
  if (mode === 'on') {
    return <p className="mt-1.5 text-xs text-white/35">{cleaned}</p>
  }
  return (
    <p className="mt-1.5 text-xs text-white/35">
      <span className="blur-[0.32rem] transition-[filter] duration-150 hover:blur-none">
        {cleaned}
      </span>
    </p>
  )
}

const speakerMeta = (speaker: string) => {
  const s = speaker.toLowerCase()
  if (s === 'you')
    return {
      icon: User,
      badge: 'Y',
      avatarClass: 'bg-[#7ec7bf]/20 text-[#7ec7bf]',
      labelClass: 'text-[#7ec7bf]/60',
    }
  return {
    icon: Bot,
    badge: s === 'coach' ? 'C' : 'T',
    avatarClass: 'bg-[#f08b5d]/20 text-[#f08b5d]',
    labelClass: 'text-[#f08b5d]/60',
  }
}

const StaticTranscriptLine = ({
  speaker,
  text,
  translation,
  translationMode,
}: {
  speaker: string
  text: string
  translation?: string
  translationMode?: TranslationMode
}) => {
  const meta = speakerMeta(speaker)
  return (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${meta.avatarClass}`}
      >
        {meta.badge}
      </span>
      <div className="min-w-0 flex-1 rounded-xl bg-white/[0.03] px-3 py-2.5">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${meta.labelClass}`}
        >
          {speaker}
        </p>
        <p className="text-sm leading-relaxed text-white/90">{text}</p>
        {translation && translationMode ? (
          <TranslationLine text={translation} mode={translationMode} />
        ) : null}
      </div>
    </div>
  )
}

const StreamedTranscriptLine = ({
  event,
  streamUrl,
  isDriven,
  translation,
  translationMode,
  onStreamComplete,
  onStreamSegment,
  onStreamDelta,
}: {
  event: TranscriptEvent
  streamUrl: URL
  isDriven: boolean
  translation?: string
  translationMode: TranslationMode
  onStreamComplete: (streamId: string, text: string, status: string) => void
  onStreamSegment: (streamId: string, segment: string, isFinal: boolean) => void
  onStreamDelta?: (streamId: string, delta: string) => void
}) => {
  const stream = useCoachStream({
    streamId: event.streamId,
    streamUrl,
    isDriven,
    notifyOnComplete: isDriven,
    onComplete: onStreamComplete,
    notifyOnSegment: isDriven,
    onSegment: onStreamSegment,
    notifyOnDelta: isDriven,
    onDelta: onStreamDelta,
  })

  const thinking =
    stream.status === 'pending' || stream.status === 'streaming'
      ? 'Coach is thinking...'
      : ''
  const displayText = sanitizeSpeechText(stream.text || event.text || thinking)

  return (
    <StaticTranscriptLine
      speaker={formatSpeaker(event.speaker)}
      text={displayText}
      translation={translation}
      translationMode={translationMode}
    />
  )
}

export const CoachTranscript = ({
  events,
  fallbackLines,
  streamUrl,
  activeStreamId,
  translations,
  translationPreferences,
  onStreamComplete,
  onStreamSegment,
  onStreamDelta,
}: CoachTranscriptProps) => {
  if (!events || events.length === 0) {
    return (
      <div className="space-y-3">
        {fallbackLines.map((line, index) => (
          <StaticTranscriptLine
            key={`${line.text}-${index}`}
            speaker={line.speaker}
            text={line.text}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) =>
        event.streamId ? (
          <StreamedTranscriptLine
            key={event._id}
            event={event}
            streamUrl={streamUrl}
            isDriven={event.streamId === activeStreamId}
            translation={translations?.[event.streamId]}
            translationMode={modeForSpeaker(
              translationPreferences,
              event.speaker,
            )}
            onStreamComplete={onStreamComplete}
            onStreamSegment={onStreamSegment}
            onStreamDelta={onStreamDelta}
          />
        ) : (
          <StaticTranscriptLine
            key={event._id}
            speaker={formatSpeaker(event.speaker)}
            text={sanitizeSpeechText(event.text ?? '')}
            translation={translations?.[event._id]}
            translationMode={modeForSpeaker(
              translationPreferences,
              event.speaker,
            )}
          />
        ),
      )}
    </div>
  )
}
