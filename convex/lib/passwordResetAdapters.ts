import { createConvexPasswordResetStore } from 'ts-common/convex/password-reset-convex-adapters'
import { createPasswordResetService } from 'ts-common/convex/password-reset-service'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type RequestId = Id<'passwordResetRequests'>
type UserId = Id<'users'>

export function createPasswordResetMutationService(ctx: MutationCtx) {
  return createPasswordResetService({
    store: createConvexPasswordResetStore<RequestId, UserId>(ctx.db),
  })
}
