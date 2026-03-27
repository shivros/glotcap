import { ConvexError } from 'convex/values'
import {
  createBilingualSegments,
  formatSrt,
  formatTranscript,
} from '../../mediaToolsDomain'
import type { IToolProcessor, ITranslationProvider } from './interfaces'
import type { MediaToolType } from './types'

class TranscriptProcessor implements IToolProcessor {
  process(args: Parameters<IToolProcessor['process']>[0]) {
    return Promise.resolve({
      transcriptText: formatTranscript(args.segments),
      segments: args.segments,
    })
  }
}

class SrtProcessor implements IToolProcessor {
  process(args: Parameters<IToolProcessor['process']>[0]) {
    return Promise.resolve({
      srtText: formatSrt(args.segments),
      segments: args.segments,
    })
  }
}

class BilingualProcessor implements IToolProcessor {
  constructor(private readonly translationProvider: ITranslationProvider) {}

  async process(args: Parameters<IToolProcessor['process']>[0]) {
    const targetLanguage = args.job.targetLanguage?.trim()
    if (!targetLanguage) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Target language is required for bilingual output.',
      })
    }

    const translated = await Promise.all(
      args.segments.map(async (segment) => {
        const translatedText = await this.translationProvider.translateSegment({
          text: segment.originalText,
          sourceLanguage: args.job.sourceLanguage,
          targetLanguage,
        })
        return {
          ...segment,
          translatedText,
        }
      }),
    )

    const delimiter = args.job.delimiter?.trim() || '---'
    const bilingualSegments = createBilingualSegments({
      segments: translated,
      delimiter,
    })

    const output = args.job.bilingualOutput ?? 'both'
    return {
      transcriptText: formatTranscript(args.segments),
      srtText: formatSrt(args.segments),
      bilingualTranscriptText:
        output === 'transcript' || output === 'both'
          ? formatTranscript(bilingualSegments)
          : undefined,
      bilingualSrtText:
        output === 'srt' || output === 'both'
          ? formatSrt(bilingualSegments)
          : undefined,
      segments: translated,
    }
  }
}

export const createToolProcessorRegistry = (args: {
  translationProvider: ITranslationProvider
}): Record<MediaToolType, IToolProcessor> => ({
  transcript: new TranscriptProcessor(),
  srt: new SrtProcessor(),
  bilingual: new BilingualProcessor(args.translationProvider),
})
