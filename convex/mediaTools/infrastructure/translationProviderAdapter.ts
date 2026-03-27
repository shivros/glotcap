import { ConvexError } from 'convex/values'
import { createTranslationService } from '../../translation_service'
import type { ITranslationProvider } from '../application/interfaces'

export class ConvexTranslationProviderAdapter implements ITranslationProvider {
  private readonly translationService = createTranslationService()

  async translateSegment(args: {
    text: string
    sourceLanguage?: string
    targetLanguage: string
  }) {
    const attempt = await this.translationService.translate({
      text: args.text,
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
    })

    if (attempt.status === 'error') {
      throw new ConvexError({
        code: 'TRANSLATION_FAILED',
        message:
          attempt.error instanceof Error
            ? attempt.error.message
            : 'Translation provider failed.',
      })
    }

    return attempt.text
  }
}
