import type {
  PasswordResetRequestRecord,
  PasswordResetStorePort,
} from './password-reset-service'

export function createConvexPasswordResetStore<TRequestId, TUserId = unknown>(
  db: any,
): PasswordResetStorePort<TRequestId, TUserId> {
  return {
    findPasswordAccountByEmail: async (email) => {
      const user = await db
        .query('users')
        .withIndex('email', (q: any) => q.eq('email', email))
        .first?.()
      if (!user) return null

      const account = await db
        .query('authAccounts')
        .withIndex('userIdAndProvider', (q: any) =>
          q.eq('userId', user._id).eq('provider', 'password'),
        )
        .unique?.()
      if (!account) return null

      return {
        providerAccountId: account.providerAccountId,
        userId: user._id as TUserId,
      }
    },

    findPendingRequestByEmail: async (email) => {
      return (await db
        .query('passwordResetRequests')
        .withIndex('by_email_status', (q: any) =>
          q.eq('email', email).eq('status', 'pending'),
        )
        .order?.('desc')
        .first()) as PasswordResetRequestRecord<TRequestId> | null
    },

    listPendingRequestsByEmail: async (email) => {
      return (await db
        .query('passwordResetRequests')
        .withIndex('by_email_status', (q: any) =>
          q.eq('email', email).eq('status', 'pending'),
        )
        .collect?.()) as Array<PasswordResetRequestRecord<TRequestId>>
    },

    findRequestByTokenHash: async (tokenHash) => {
      return (await db
        .query('passwordResetRequests')
        .withIndex('by_token_hash', (q: any) => q.eq('tokenHash', tokenHash))
        .unique?.()) as PasswordResetRequestRecord<TRequestId> | null
    },

    insertRequest: async (request) => {
      await db.insert(
        'passwordResetRequests',
        request as Record<string, unknown>,
      )
    },

    patchRequest: async (requestId, patch) => {
      await db.patch(requestId, patch as Record<string, unknown>)
    },
  }
}
