import { describe, expect, it } from 'vitest'
import {
  createTtsTextPreprocessor,
  normalizeWhitespaceTransform,
  preprocessTextForTts,
  removeEndTokensTransform,
  stripEmojiTransform,
} from '../../shared/tts-text-preprocessor'

describe('tts text preprocessor', () => {
  it('removes end tokens and normalizes whitespace in default pipeline', () => {
    const preprocessor = createTtsTextPreprocessor()
    expect(preprocessor('Hello <end>  world')).toEqual({
      ok: true,
      text: 'Hello world',
    })
  })

  it('strips standalone and mixed emojis while keeping text', () => {
    const preprocessor = createTtsTextPreprocessor()
    expect(preprocessor('Hola 👋 mundo 🌍')).toEqual({
      ok: true,
      text: 'Hola mundo',
    })
    expect(preprocessor('Como estas? 😀')).toEqual({
      ok: true,
      text: 'Como estas?',
    })
  })

  it('strips emoji sequences such as zwj, flags, and keycaps', () => {
    const preprocessor = createTtsTextPreprocessor()
    expect(preprocessor('Family 👨‍👩‍👧‍👦 test')).toEqual({
      ok: true,
      text: 'Family test',
    })
    expect(preprocessor('Flag 🇺🇸 and keycap 1️⃣ done')).toEqual({
      ok: true,
      text: 'Flag and keycap done',
    })
  })

  it('returns empty_after_preprocessing for emoji-only input', () => {
    const preprocessor = createTtsTextPreprocessor()
    expect(preprocessor('😀 🎉 ❤️')).toEqual({
      ok: false,
      reason: 'empty_after_preprocessing',
    })
  })

  it('returns empty_after_preprocessing for empty input', () => {
    const preprocessor = createTtsTextPreprocessor()
    expect(preprocessor('')).toEqual({
      ok: false,
      reason: 'empty_after_preprocessing',
    })
  })

  it('supports open-closed composition with custom transform lists', () => {
    const preprocessor = createTtsTextPreprocessor([
      removeEndTokensTransform,
      (value) => value.replace(/coach/gi, 'teacher'),
      normalizeWhitespaceTransform,
    ])

    expect(preprocessor('coach <end> ready')).toEqual({
      ok: true,
      text: 'teacher ready',
    })
  })

  it('keeps backward-compatible preprocessTextForTts helper', () => {
    expect(preprocessTextForTts('hello 😀')).toBe('hello')
    expect(preprocessTextForTts('😀')).toBe('')
  })

  it('exposes transform-level behavior independently', () => {
    expect(removeEndTokensTransform('a <end> b')).toBe('a   b')
    expect(stripEmojiTransform('a😀b')).toBe('a b')
    expect(normalizeWhitespaceTransform('a   b')).toBe('a b')
  })
})
