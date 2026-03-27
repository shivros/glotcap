import { createEmailChangeService } from 'ts-common/convex/email-change-service'
import type {
  EmailChangeAuthAccountPort,
  EmailChangeStorePort,
} from 'ts-common/convex/email-change-service'
import type {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from '../_generated/server'
import type { Id } from '../_generated/dataModel'

type EmailChangeRequestId = Id<'emailChangeRequests'>
type UserId = Id<'users'>

type ReaderWriter = DatabaseReader & DatabaseWriter

export function createConvexEmailChangeStore(
  db: ReaderWriter,
): EmailChangeStorePort<UserId, EmailChangeRequestId> {
  return {
    getUserById: async (userId) => {
      return await db.get(userId)
    },
    findUsersByEmail: async (email) => {
      return await db
        .query('users')
        .withIndex('email', (q) => q.eq('email', email))
        .collect()
    },
    findPendingRequestByUser: async (userId) => {
      return await db
        .query('emailChangeRequests')
        .withIndex('by_user_status', (q) =>
          q.eq('userId', userId).eq('status', 'pending'),
        )
        .order('desc')
        .first()
    },
    listPendingRequestsByUser: async (userId) => {
      return await db
        .query('emailChangeRequests')
        .withIndex('by_user_status', (q) =>
          q.eq('userId', userId).eq('status', 'pending'),
        )
        .collect()
    },
    findPendingRequestByNewEmail: async (email) => {
      return await db
        .query('emailChangeRequests')
        .withIndex('by_new_email_status', (q) =>
          q.eq('newEmail', email).eq('status', 'pending'),
        )
        .first()
    },
    findRequestByTokenHash: async (tokenHash) => {
      return await db
        .query('emailChangeRequests')
        .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
        .unique()
    },
    insertRequest: async (request) => {
      await db.insert('emailChangeRequests', request)
    },
    patchRequest: async (requestId, patch) => {
      await db.patch(requestId, patch)
    },
    patchUser: async (userId, patch) => {
      await db.patch(userId, patch)
    },
  }
}

export function createPasswordAccountPort(
  db: ReaderWriter,
  providerIds: ReadonlyArray<string> = ['password'],
): EmailChangeAuthAccountPort<UserId> {
  return {
    finalizeEmailIdentifierChange: async ({ userId, newEmail }) => {
      const accountIdsToPatch: Array<Id<'authAccounts'>> = []

      for (const providerId of providerIds) {
        const account = await db
          .query('authAccounts')
          .withIndex('userIdAndProvider', (q) =>
            q.eq('userId', userId).eq('provider', providerId),
          )
          .unique()

        if (!account) {
          continue
        }

        const conflicting = await db
          .query('authAccounts')
          .withIndex('providerAndAccountId', (q) =>
            q.eq('provider', providerId).eq('providerAccountId', newEmail),
          )
          .unique()

        if (conflicting && conflicting._id !== account._id) {
          return 'email_taken'
        }

        accountIdsToPatch.push(account._id)
      }

      for (const accountId of accountIdsToPatch) {
        await db.patch(accountId, {
          providerAccountId: newEmail,
          emailVerified: newEmail,
        })
      }

      return 'ok'
    },
  }
}

export function createEmailChangeMutationService(
  ctx: MutationCtx,
  getSiteUrl: () => string = () => 'http://localhost',
) {
  return createEmailChangeService({
    store: createConvexEmailChangeStore(ctx.db),
    authAccounts: createPasswordAccountPort(ctx.db),
    mailer: { sendVerificationEmail: () => Promise.resolve() },
    getSiteUrl,
  })
}
