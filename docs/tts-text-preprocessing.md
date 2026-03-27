# TTS Text Preprocessing

This project preprocesses coach text before sending it to TTS providers.

## Interface

- `TtsTextPreprocessor`: `(value: string) => TtsTextPreprocessResult`
- `TtsTextPreprocessResult`:
  - `{ ok: true, text: string }`
  - `{ ok: false, reason: 'empty_after_preprocessing' }`

## Default Pipeline

The default preprocessor is composed from three transforms:

1. `removeEndTokensTransform`
2. `stripEmojiTransform`
3. `normalizeWhitespaceTransform`

## Behavior By Layer

- Client playback (`useCoachPlayback`): skips speech when preprocessing is empty.
- TTS port (`createCoachTtsPort`): throws when preprocessing is empty.
- Convex action (`tts.synthesize`): throws `ConvexError` with `code: 'TTS_TEXT_EMPTY'`.
- Convex HTTP action (`/tts-stream`): returns `400`.

## Extending Without Editing Callers

Inject a custom preprocessor into boundaries:

- `createCoachTtsPort({ getConfig })` via `config.preprocessor`
- `useCoachPlayback(...)` via `ttsTextPreprocessor`
- `createSynthesizeHandler({ preprocessor })`
- `createStreamHandler({ preprocessor })`

This allows provider-specific or environment-specific text policies without
modifying high-level modules.
