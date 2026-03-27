import { createSttConnectionCoordinator as createSharedSttConnectionCoordinator } from 'ts-common/speech/stt'
import type { Id } from '../../../convex/_generated/dataModel'
import type {
  CreateSessionArgs as SharedCreateSessionArgs,
  SttConnectionCoordinator as SharedSttConnectionCoordinator,
  SttConnectionCoordinatorDeps as SharedSttConnectionCoordinatorDeps,
} from 'ts-common/speech/stt'

type SpeakingSessionId = Id<'speakingSessions'>

export type CreateSessionArgs = SharedCreateSessionArgs<SpeakingSessionId>

export type SttConnectionCoordinatorDeps =
  SharedSttConnectionCoordinatorDeps<SpeakingSessionId>

export type SttConnectionCoordinator =
  SharedSttConnectionCoordinator<SpeakingSessionId>

export const createSttConnectionCoordinator = ({
  getDeps,
}: {
  getDeps: () => SttConnectionCoordinatorDeps
}): SttConnectionCoordinator =>
  createSharedSttConnectionCoordinator<SpeakingSessionId>({
    getDeps,
  })
