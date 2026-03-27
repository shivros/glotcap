import { internal } from '../_generated/api'
import type { ChatMessage } from 'ts-common/llm'
import type { Id } from '../_generated/dataModel'
import type { CoachStreamContext } from './types'

type CoachHistoryParams = {
  sessionId: Id<'speakingSessions'>
  excludeStreamId?: string
  limit: number
}

export const fetchCoachHistory = async (
  ctx: CoachStreamContext,
  params: CoachHistoryParams,
) => {
  const messages = await ctx.runQuery(internal.speaking.getCoachHistory, params)
  return messages as Array<ChatMessage>
}
