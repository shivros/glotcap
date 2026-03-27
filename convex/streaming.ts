import {
  PersistentTextStreaming,
  StreamIdValidator,
} from '@convex-dev/persistent-text-streaming'
import {
  createGetStreamBodyQuery,
  createPersistentTextStreaming,
} from 'ts-common/convex/streaming'
import { components } from './_generated/api'
import { query } from './_generated/server'

export const streamingComponent = createPersistentTextStreaming(
  PersistentTextStreaming,
  components.persistentTextStreaming,
)

export const getStreamBody = createGetStreamBodyQuery(
  query,
  StreamIdValidator,
  streamingComponent,
)
