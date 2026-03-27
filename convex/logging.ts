import {
  createListRecentQuery,
  createLogEventMutation,
} from 'ts-common/logging/convex'
import { mutation, query } from './_generated/server'

export const logEvent = createLogEventMutation(mutation)
export const listRecent = createListRecentQuery(query)
