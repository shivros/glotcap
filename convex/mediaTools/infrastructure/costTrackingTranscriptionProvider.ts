'use node'

import type { CostActionCtx } from '../../costs/ports'
import type { ToolUsageCostService } from '../../costs/toolUsageCostService'
import type { SubtitleSegment } from '../../mediaToolsDomain'
import type { ITranscriptionProvider } from '../application/interfaces'

export class CostTrackingTranscriptionProvider implements ITranscriptionProvider {
  constructor(
    private readonly dependencies: {
      provider: ITranscriptionProvider
      ctx: CostActionCtx
      toolUsageCostService: ToolUsageCostService
      threadId: string
      userId?: string
      providerName?: string
      modelIdResolver?: () => string
    },
  ) {}

  async transcribe(args: {
    blob: Blob
    fileName: string
    sourceLanguage?: string
  }) {
    try {
      const result = await this.dependencies.provider.transcribe(args)

      await this.recordCost({
        transcript: result.transcript,
        segments: result.segments,
        status: 'ok',
      })

      return result
    } catch (error) {
      await this.recordCost({
        transcript: '',
        segments: [],
        status: 'error',
      })
      throw error
    }
  }

  private async recordCost(args: {
    transcript: string
    segments: Array<SubtitleSegment>
    status: 'ok' | 'error'
  }) {
    const startedAt = args.segments.at(0)?.startMs
    const endedAt = args.segments.at(-1)?.endMs
    const durationMs =
      typeof startedAt === 'number' && typeof endedAt === 'number'
        ? Math.max(0, endedAt - startedAt)
        : undefined

    try {
      await this.dependencies.toolUsageCostService.recordTranscriptionCost(
        this.dependencies.ctx,
        {
          operation: 'media-tools-transcription',
          threadId: this.dependencies.threadId,
          userId: this.dependencies.userId,
          providerName: this.dependencies.providerName ?? 'openai',
          modelId:
            this.dependencies.modelIdResolver?.() ??
            process.env.WHISPER_MODEL ??
            'whisper-1',
          transcriptText: args.transcript,
          audioSeconds:
            typeof durationMs === 'number'
              ? Math.max(1, durationMs / 1000)
              : undefined,
          metadata: {
            status: args.status,
            segmentCount: args.segments.length,
          },
        },
      )
    } catch (costError) {
      console.error('Failed to record transcription cost', costError)
    }
  }
}
