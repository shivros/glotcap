'use node'

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { MediaToolJobService } from './mediaTools/application/jobService'
import { createToolProcessorRegistry } from './mediaTools/application/processors'
import { ConvexJobStore } from './mediaTools/infrastructure/convexJobStore'
import { MediaToolInputLoader } from './mediaTools/infrastructure/inputLoader'
import { createMediaToolsProviders } from './mediaTools/infrastructure/runtimeFactory'

export const processJob = internalAction({
  args: {
    jobId: v.id('mediaToolJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const providers = createMediaToolsProviders({
      ctx,
      threadId: `media-tools:${args.jobId}`,
    })
    const inputLoader = new MediaToolInputLoader({
      getBlob: (storageId) => ctx.storage.get(storageId),
      transcriptionProvider: providers.transcriptionProvider,
    })
    const processors = createToolProcessorRegistry({
      translationProvider: providers.translationProvider,
    })
    const jobStore = new ConvexJobStore(ctx)

    const service = new MediaToolJobService({
      inputLoader,
      processors,
      jobStore,
    })
    await service.run(args.jobId)

    return null
  },
})
