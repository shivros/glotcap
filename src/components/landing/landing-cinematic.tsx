import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  AudioLines,
  Brain,
  Globe,
  MessageCircle,
  Mic,
  Sparkles,
  Zap,
} from 'lucide-react'

type LandingCinematicProps = {
  onSignIn?: () => void
  onStartFree?: () => void
  demoHref?: string
}

const languages = [
  { code: 'fr', name: 'French', phrase: 'Bonjour le monde' },
  { code: 'es', name: 'Spanish', phrase: 'Hola mundo' },
  { code: 'de', name: 'German', phrase: 'Hallo Welt' },
  { code: 'ja', name: 'Japanese', phrase: 'こんにちは世界' },
  { code: 'ko', name: 'Korean', phrase: '안녕하세요 세계' },
  { code: 'pt', name: 'Portuguese', phrase: 'Olá mundo' },
  { code: 'ru', name: 'Russian', phrase: 'Привет мир' },
  { code: 'zh', name: 'Mandarin', phrase: '你好世界' },
]

const conversationLines = [
  { speaker: 'you', text: 'Je voudrais aller au cinéma ce soir.' },
  { speaker: 'coach', text: 'Bonne idée ! Quel film tu veux voir ?' },
  { speaker: 'you', text: 'Je ne sais pas encore. Tu as une recommandation ?' },
  {
    speaker: 'coach',
    text: 'Il y a un nouveau film français qui est très bien !',
  },
]

const corrections = [
  {
    type: 'good' as const,
    text: 'Excellent use of conditionnel with "voudrais"',
  },
  { type: 'fix' as const, text: '"recommandation" → use "suggestion" here' },
  { type: 'good' as const, text: 'Natural question formation with inversion' },
]

const getWaveJitter = (index: number) =>
  ((Math.sin(index * 12.9898 + 78.233) + 1) / 2) * 8

function FloatingBubble({
  children,
  delay,
  x,
  y,
  size,
}: {
  children: React.ReactNode
  delay: number
  x: string
  y: string
  size: string
}) {
  return (
    <div
      className="absolute rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
      style={{
        left: x,
        top: y,
        width: size,
        animation: `cinematic-float 8s ease-in-out ${delay}s infinite, cinematic-fade-in 1s ease-out ${delay * 0.3}s both`,
      }}
    >
      {children}
    </div>
  )
}

function AuroraBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-1/2 left-1/4 h-[120vh] w-[80vw] rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            'conic-gradient(from 180deg at 50% 50%, #1d6c63 0deg, #7ec7bf 120deg, #f08b5d 240deg, #1d6c63 360deg)',
          animation: 'cinematic-rotate 20s linear infinite',
        }}
      />
      <div
        className="absolute -bottom-1/3 right-1/4 h-[80vh] w-[60vw] rounded-full opacity-20 blur-[100px]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, #d8efe9 0deg, #1d6c63 180deg, #d8efe9 360deg)',
          animation: 'cinematic-rotate 25s linear infinite reverse',
        }}
      />
    </div>
  )
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 pl-1">
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-40"
        style={{ animation: 'cinematic-dot 1.4s ease-in-out infinite' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-40"
        style={{ animation: 'cinematic-dot 1.4s ease-in-out 0.2s infinite' }}
      />
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-40"
        style={{ animation: 'cinematic-dot 1.4s ease-in-out 0.4s infinite' }}
      />
    </span>
  )
}

function ConversationDemo() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [visibleCorrections, setVisibleCorrections] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const lineTimers = conversationLines.map((_, i) =>
      setTimeout(() => setVisibleLines(i + 1), 1200 + i * 1800),
    )
    const correctionTimers = corrections.map((_, i) =>
      setTimeout(() => setVisibleCorrections(i + 1), 3000 + i * 2200),
    )
    return () => {
      lineTimers.forEach(clearTimeout)
      correctionTimers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117]/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Session bar */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1d6c63]">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Live Session</p>
              <p className="text-xs text-white/40">French · A2–B1</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#f08b5d]" />
            <span className="text-xs text-white/40">Recording</span>
          </div>
        </div>

        {/* Waveform */}
        <div className="flex items-end justify-center gap-[3px] border-b border-white/5 px-6 py-3">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-[#1d6c63]/60"
              style={{
                height: `${8 + Math.sin(i * 0.5) * 16 + getWaveJitter(i)}px`,
                animation: `cinematic-bar 1.5s ease-in-out ${i * 0.05}s infinite alternate`,
              }}
            />
          ))}
        </div>

        {/* Transcript */}
        <div ref={containerRef} className="space-y-4 p-6">
          {conversationLines.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className="flex gap-3"
              style={{
                animation: 'cinematic-slide-up 0.5s ease-out both',
              }}
            >
              <span
                className={`mt-1 h-6 w-6 shrink-0 rounded-full text-center text-xs font-bold leading-6 ${
                  line.speaker === 'you'
                    ? 'bg-[#7ec7bf]/20 text-[#7ec7bf]'
                    : 'bg-[#f08b5d]/20 text-[#f08b5d]'
                }`}
              >
                {line.speaker === 'you' ? 'Y' : 'C'}
              </span>
              <div>
                <p className="text-xs font-medium text-white/40">
                  {line.speaker === 'you' ? 'You' : 'Coach'}
                </p>
                <p className="text-sm leading-relaxed text-white/90">
                  {line.text}
                </p>
              </div>
            </div>
          ))}
          {visibleLines < conversationLines.length && visibleLines > 0 && (
            <div className="flex gap-3">
              <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-[#f08b5d]/20 text-center text-xs font-bold leading-6 text-[#f08b5d]">
                C
              </span>
              <div>
                <p className="text-xs font-medium text-white/40">Coach</p>
                <p className="text-sm text-white/60">
                  <TypingIndicator />
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Corrections sidebar */}
        {visibleCorrections > 0 && (
          <div className="border-t border-white/5 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
              <Sparkles className="h-3 w-3" /> Live corrections
            </p>
            <div className="space-y-2">
              {corrections.slice(0, visibleCorrections).map((c, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    c.type === 'good'
                      ? 'bg-[#1d6c63]/15 text-[#7ec7bf]'
                      : 'bg-[#f08b5d]/10 text-[#f08b5d]'
                  }`}
                  style={{
                    animation: 'cinematic-slide-up 0.4s ease-out both',
                  }}
                >
                  <span className="mr-1.5 font-bold">
                    {c.type === 'good' ? '✓' : '→'}
                  </span>
                  {c.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function LandingCinematic({
  onSignIn,
  onStartFree,
  demoHref,
}: LandingCinematicProps = {}) {
  const [activeLang, setActiveLang] = useState(0)

  useEffect(() => {
    const interval = setInterval(
      () => setActiveLang((p) => (p + 1) % languages.length),
      2500,
    )
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative min-h-screen bg-[#080c10] text-white">
      <style>{`
        @keyframes cinematic-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes cinematic-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cinematic-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cinematic-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes cinematic-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cinematic-bar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        @keyframes cinematic-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes cinematic-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <AuroraBg />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d6c63] text-white shadow-lg shadow-[#1d6c63]/30">
            <AudioLines className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">GlotCap</span>
        </div>
        <div className="hidden items-center gap-8 text-sm text-white/50 md:flex">
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#method" className="transition hover:text-white">
            Method
          </a>
          <a href="#levels" className="transition hover:text-white">
            Levels
          </a>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm text-white/70 transition hover:text-white"
            onClick={onSignIn}
          >
            Sign in
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#1d6c63] px-5 py-2 text-sm font-medium shadow-lg shadow-[#1d6c63]/25 transition hover:bg-[#1d6c63]/80"
            onClick={onStartFree}
          >
            Start free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 pb-16 pt-20 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          {/* Language ticker */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <Globe className="h-4 w-4 text-[#7ec7bf]" />
            <div className="relative h-7 w-48 overflow-hidden">
              {languages.map((lang, i) => (
                <span
                  key={lang.code}
                  className="absolute inset-0 flex items-center justify-center text-sm font-medium transition-all duration-500"
                  style={{
                    opacity: i === activeLang ? 1 : 0,
                    transform:
                      i === activeLang ? 'translateY(0)' : 'translateY(100%)',
                    color: '#7ec7bf',
                  }}
                >
                  {lang.phrase}
                </span>
              ))}
            </div>
          </div>

          <h1
            className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-5xl font-bold leading-[1.1] tracking-tight text-transparent md:text-7xl lg:text-8xl"
            style={{
              animation: 'cinematic-fade-in 1s ease-out both',
            }}
          >
            Speak fluently.
            <br />
            <span className="bg-gradient-to-r from-[#1d6c63] via-[#7ec7bf] to-[#f08b5d] bg-clip-text text-transparent">
              Get live feedback.
            </span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl text-lg text-white/50 md:text-xl"
            style={{
              animation: 'cinematic-fade-in 1s ease-out 0.2s both',
            }}
          >
            An AI speaking coach that listens, responds, and corrects in real
            time — without breaking the flow of conversation.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            style={{ animation: 'cinematic-fade-in 1s ease-out 0.4s both' }}
          >
            <button
              type="button"
              className="group flex items-center gap-2 rounded-2xl bg-[#1d6c63] px-8 py-4 text-base font-medium shadow-xl shadow-[#1d6c63]/25 transition hover:shadow-[#1d6c63]/40"
              onClick={onStartFree}
            >
              <Mic className="h-5 w-5" />
              Start speaking now
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            {demoHref ? (
              <a
                href={demoHref}
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium backdrop-blur transition hover:bg-white/10"
              >
                Live Demo
              </a>
            ) : (
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium backdrop-blur transition hover:bg-white/10"
                onClick={onStartFree}
              >
                Live Demo
              </button>
            )}
          </div>
        </div>

        {/* Demo */}
        <div
          className="relative mt-20"
          style={{ animation: 'cinematic-fade-in 1.2s ease-out 0.6s both' }}
        >
          {/* Glow behind demo */}
          <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-r from-[#1d6c63]/20 via-transparent to-[#f08b5d]/20 blur-3xl" />

          <ConversationDemo />

          {/* Floating bubbles */}
          <FloatingBubble delay={0} x="-6%" y="10%" size="180px">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Brain className="h-4 w-4 text-[#7ec7bf]" />
              <span>SRS adapts to you</span>
            </div>
          </FloatingBubble>
          <FloatingBubble delay={1.5} x="92%" y="25%" size="200px">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <AudioLines className="h-4 w-4 text-[#f08b5d]" />
              <span>A1 → C1 progression</span>
            </div>
          </FloatingBubble>
          <FloatingBubble delay={0.8} x="85%" y="70%" size="170px">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Zap className="h-4 w-4 text-[#7ec7bf]" />
              <span>Sub-second feedback</span>
            </div>
          </FloatingBubble>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-8 py-32"
      >
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7ec7bf]">
            Three pillars
          </p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Everything you need to become fluent
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: MessageCircle,
              title: 'Live Speaking Coach',
              description:
                'Real-time conversation with an AI that corrects grammar, pronunciation, and vocabulary inline — never interrupting your flow.',
              color: '#1d6c63',
              gradient: 'from-[#1d6c63]/20 to-transparent',
            },
            {
              icon: AudioLines,
              title: 'Audio Translation Drills',
              description:
                'Glossika-style mass sentence practice. Hear English, speak the target language. Progress from A1 through C1 with thousands of sentences.',
              color: '#7ec7bf',
              gradient: 'from-[#7ec7bf]/20 to-transparent',
            },
            {
              icon: Brain,
              title: 'AI Spaced Repetition',
              description:
                'Cards generated from your mistakes. The algorithm knows your weak spots and builds a review queue that actually targets what you need.',
              color: '#f08b5d',
              gradient: 'from-[#f08b5d]/20 to-transparent',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-b ${feature.gradient} opacity-0 transition group-hover:opacity-100`}
              />
              <div className="relative">
                <div
                  className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <feature.icon
                    className="h-7 w-7"
                    style={{ color: feature.color }}
                  />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="leading-relaxed text-white/50">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Language marquee */}
      <section className="relative z-10 overflow-hidden border-y border-white/5 py-6">
        <div
          className="flex items-center gap-8 whitespace-nowrap"
          style={{
            animation: 'cinematic-marquee 30s linear infinite',
            width: 'max-content',
          }}
        >
          {[...languages, ...languages, ...languages].map((lang, i) => (
            <span
              key={`${lang.code}-${i}`}
              className="text-lg font-medium text-white/15"
            >
              {lang.phrase}
            </span>
          ))}
        </div>
      </section>

      {/* Method */}
      <section
        id="method"
        className="relative z-10 mx-auto max-w-5xl px-8 py-32"
      >
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#f08b5d]">
              The method
            </p>
            <h2 className="mt-3 text-4xl font-bold">
              Speak first. Study second.
            </h2>
            <p className="mt-4 leading-relaxed text-white/50">
              Traditional apps drill vocabulary in isolation. GlotCap reverses
              the order: start with real conversation, and let your mistakes
              drive what you study next.
            </p>
            <div className="mt-8 space-y-4">
              {[
                'Speak with the AI coach → mistakes are captured',
                'Weak spots become SRS cards automatically',
                'Audio drills reinforce the exact patterns you struggle with',
                'Track your CEFR progress from A1 to C1',
              ].map((step, i) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d6c63]/20 text-xs font-bold text-[#7ec7bf]">
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/60">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#1d6c63]/10 to-[#f08b5d]/10 blur-2xl" />
            <div className="relative space-y-4 rounded-3xl border border-white/5 bg-[#0d1117]/60 p-6 backdrop-blur">
              {[
                'A1 · Beginner',
                'A2 · Elementary',
                'B1 · Intermediate',
                'B2 · Upper Intermediate',
                'C1 · Advanced',
              ].map((level, i) => (
                <div key={level} className="flex items-center gap-4">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#1d6c63] to-[#7ec7bf]"
                    style={{
                      width: `${20 + i * 20}%`,
                      opacity: 0.4 + i * 0.15,
                    }}
                  />
                  <span className="shrink-0 text-xs text-white/40">
                    {level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-8 pb-32 text-center">
        <div className="rounded-[40px] border border-white/5 bg-gradient-to-b from-[#1d6c63]/10 to-transparent p-16">
          <h2 className="text-4xl font-bold md:text-5xl">
            Ready to start speaking?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/50">
            No credit card, no signup wall. Just open your mouth and go.
          </p>
          <button
            type="button"
            className="mt-8 rounded-2xl bg-[#1d6c63] px-10 py-4 text-base font-medium shadow-xl shadow-[#1d6c63]/25 transition hover:shadow-[#1d6c63]/40"
            onClick={onStartFree}
          >
            Try the live demo
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/30">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1d6c63] text-[10px] font-bold text-white">
              GC
            </div>
            GlotCap
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy-policy"
              className="text-xs text-white/20 transition-colors hover:text-white/40"
            >
              Privacy
            </Link>
            <Link
              to="/terms-of-service"
              className="text-xs text-white/20 transition-colors hover:text-white/40"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
