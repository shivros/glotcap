import { createListTaskErrorsQuery } from 'ts-common/task-errors/convex'
import { query } from './_generated/server'
import { auth } from './auth'

export const listRecent = createListTaskErrorsQuery(query, {
  getUserId: (ctx) => auth.getUserId(ctx),
})
