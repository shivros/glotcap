import {
  getAuthSessionId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from '@convex-dev/auth/server'
import { isInvalidCredentialsError } from 'ts-common/convex/password-change-service'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import type { PasswordAuthGateway } from 'ts-common/convex/password-change-service'

export function createPasswordAuthGateway(
  ctx: ActionCtx,
): PasswordAuthGateway<Id<'users'>, Id<'authSessions'>> {
  return {
    async getPasswordAccountIdentifier(userId) {
      const account = await ctx.runQuery(
        internal.accountSecurityInternal.getPasswordAccountByUser,
        {
          userId,
        },
      )
      return account?.providerAccountId ?? null
    },

    async verifyCurrentPassword({
      userId,
      providerAccountId,
      currentPassword,
    }) {
      try {
        const result = await retrieveAccount(ctx, {
          provider: 'password',
          account: {
            id: providerAccountId,
            secret: currentPassword,
          },
        })

        if (result.user._id !== userId) {
          return 'invalid'
        }

        return 'valid'
      } catch (error) {
        if (isInvalidCredentialsError(error)) {
          return 'invalid'
        }
        throw error
      }
    },

    async updatePassword({ providerAccountId, newPassword }) {
      await modifyAccountCredentials(ctx, {
        provider: 'password',
        account: {
          id: providerAccountId,
          secret: newPassword,
        },
      })
    },

    async getCurrentSessionId() {
      return await getAuthSessionId(ctx)
    },

    async invalidateOtherSessions({ userId, currentSessionId }) {
      await invalidateSessions(ctx, {
        userId,
        except: currentSessionId ? [currentSessionId] : undefined,
      })
    },
  }
}
