import { ConvexError } from 'convex/values'
import { formatTranscript, parseSrt } from '../../mediaToolsDomain'
import type { Id } from '../../_generated/dataModel'
import type {
  IInputLoader,
  ITranscriptionProvider,
} from '../application/interfaces'

const decodeBlobAsText = async (blob: Blob) => {
  const text = await blob.text()
  return text.replace(/\r/g, '')
}

const inferFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split('.')
  if (parts.length < 2) {
    return ''
  }
  return parts.at(-1) ?? ''
}

export class MediaToolInputLoader implements IInputLoader {
  constructor(
    private readonly dependencies: {
      getBlob: (storageId: Id<'_storage'>) => Promise<Blob | null>
      transcriptionProvider: ITranscriptionProvider
    },
  ) {}

  async load(args: {
    storageId: Id<'_storage'>
    fileName: string
    sourceLanguage?: string
  }) {
    const blob = await this.dependencies.getBlob(args.storageId)
    if (!blob) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Input file could not be loaded from storage.',
      })
    }

    const extension = inferFileExtension(args.fileName)
    const isSrtInput = extension === 'srt' || blob.type.includes('subrip')

    if (isSrtInput) {
      const rawSrt = await decodeBlobAsText(blob)
      const segments = parseSrt(rawSrt)
      if (segments.length === 0) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'SRT input does not contain valid subtitle blocks.',
        })
      }
      return {
        transcript: formatTranscript(segments),
        segments,
      }
    }

    return await this.dependencies.transcriptionProvider.transcribe({
      blob,
      fileName: args.fileName,
      sourceLanguage: args.sourceLanguage,
    })
  }
}
