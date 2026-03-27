import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TranslationPreferences } from '@/lib/translation-preferences'
import { CoachTranscript } from '@/components/coach-transcript'

const streamUrl = new URL('https://example.com/coach-stream')

const renderTranscript = (translationPreferences: TranslationPreferences) =>
  render(
    <CoachTranscript
      events={[
        { _id: 'user-1', speaker: 'user', text: 'bonjour' },
        { _id: 'coach-1', speaker: 'coach', text: 'salut' },
      ]}
      fallbackLines={[]}
      streamUrl={streamUrl}
      translations={{
        'user-1': 'hello',
        'coach-1': 'hi',
      }}
      translationPreferences={translationPreferences}
      onStreamComplete={() => {}}
      onStreamSegment={() => {}}
    />,
  )

describe('CoachTranscript translation visibility', () => {
  it('shows counterpart translations independently from self translations', () => {
    renderTranscript({
      self: 'off',
      counterpart: 'on',
    })

    expect(screen.queryByText('hi')).not.toBeNull()
    expect(screen.queryByText('hello')).toBeNull()
  })

  it('shows self translations independently from counterpart translations', () => {
    renderTranscript({
      self: 'on',
      counterpart: 'off',
    })

    expect(screen.queryByText('hello')).not.toBeNull()
    expect(screen.queryByText('hi')).toBeNull()
  })

  it('renders blur-reveal style when hover mode is selected', () => {
    renderTranscript({
      self: 'off',
      counterpart: 'hover',
    })

    const translation = screen.getByText('hi')
    expect(translation.className).toContain('blur-[0.32rem]')
    expect(translation.className).toContain('hover:blur-none')
  })
})
