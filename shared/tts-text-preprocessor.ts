const END_TOKEN_REGEX = /<\s*end\s*>/gi

const EMOJI_SEQUENCE_REGEX =
  /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)/gu

const EMOJI_ARTIFACT_REGEX =
  /(?:[\uFE0E\uFE0F\u200D]|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u{E0020}-\u{E007E}\u{E007F}])/gu

export type TtsTextPreprocessFailureReason = 'empty_after_preprocessing'

export type TtsTextPreprocessResult =
  | { ok: true; text: string }
  | { ok: false; reason: TtsTextPreprocessFailureReason }

export type TtsTextTransform = (value: string) => string

export type TtsTextPreprocessor = (value: string) => TtsTextPreprocessResult

export const removeEndTokensTransform: TtsTextTransform = (value) =>
  value.replace(END_TOKEN_REGEX, ' ')

export const stripEmojiTransform: TtsTextTransform = (value) =>
  value.replace(EMOJI_SEQUENCE_REGEX, ' ').replace(EMOJI_ARTIFACT_REGEX, ' ')

export const normalizeWhitespaceTransform: TtsTextTransform = (value) =>
  value.replace(/\s+/g, ' ').trim()

export const composeTtsTextTransforms = (
  transforms: ReadonlyArray<TtsTextTransform>,
) => {
  return (value: string) =>
    transforms.reduce((current, transform) => transform(current), value)
}

export const DEFAULT_TTS_TEXT_TRANSFORMS = [
  removeEndTokensTransform,
  stripEmojiTransform,
  normalizeWhitespaceTransform,
] as const

export const createTtsTextPreprocessor = (
  transforms: ReadonlyArray<TtsTextTransform> = DEFAULT_TTS_TEXT_TRANSFORMS,
): TtsTextPreprocessor => {
  const applyTransforms = composeTtsTextTransforms(transforms)
  return (value: string) => {
    if (!value) {
      return {
        ok: false,
        reason: 'empty_after_preprocessing',
      }
    }

    const text = applyTransforms(value)
    if (!text) {
      return {
        ok: false,
        reason: 'empty_after_preprocessing',
      }
    }

    return {
      ok: true,
      text,
    }
  }
}

const DEFAULT_PREPROCESSOR = createTtsTextPreprocessor()

export const preprocessTextForTts = (value: string) => {
  const result = DEFAULT_PREPROCESSOR(value)
  return result.ok ? result.text : ''
}
