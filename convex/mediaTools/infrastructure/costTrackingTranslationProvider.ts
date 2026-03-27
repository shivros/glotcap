'use node'

import type { CostActionCtx } from '../../costs/ports'
import type { ToolUsageCostService } from '../../costs/toolUsageCostService'
import type { ITranslationProvider } from '../application/interfaces'

export class CostTrackingTranslationProvider implements ITranslationProvider {
  constructor(
    private readonly dependencies: {
      provider: ITranslationProvider
      ctx: CostActionCtx
      toolUsageCostService: ToolUsageCostService
      threadId: string
      userId?: string
      providerNameResolver?: () => string | undefined
      modelIdResolver?: () => string
    },
  ) {}

  async translateSegment(args: {
    text: string
    sourceLanguage?: string
    targetLanguage: string
  }) {
    let translatedText = ''
    let status: 'ok' | 'error' = 'ok'

    try {
      translatedText = await this.dependencies.provider.translateSegment(args)
      return translatedText
    } catch (error) {
      status = 'error'
      throw error
    } finally {
      try {
        await this.dependencies.toolUsageCostService.recordLlmStreamCost(
          this.dependencies.ctx,
          {
            operation: 'media-tools-translation-segment',
            modelId:
              this.dependencies.modelIdResolver?.() ??
              process.env.OPENROUTER_TRANSLATION_MODEL ??
              process.env.OPENROUTER_COACH_MODEL ??
              'openrouter/auto',
            providerName:
              this.dependencies.providerNameResolver?.() ??
              process.env.LLM_PROVIDER,
            threadId: this.dependencies.threadId,
            userId: this.dependencies.userId,
            inputText: args.text,
            outputText: translatedText,
            metadata: {
              status,
              sourceLanguage: args.sourceLanguage,
              targetLanguage: args.targetLanguage,
            },
          },
        )
      } catch (costError) {
        console.error(
          'Failed to record media tools translation cost',
          costError,
        )
      }
    }
  }
}
