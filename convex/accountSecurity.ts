import { ConvexError, v } from 'convex/values'
import { createSecurityCapabilitiesResolver } from 'ts-common/convex/security-capabilities'
import {
  PasswordChangeDomainError,
  changePasswordWithGateway,
} from 'ts-common/convex/password-change-service'
import { action, query } from './_generated/server'
import { AUTH_PROVIDER_IDS } from './lib/authProviderIds'
import { createPasswordAuthGateway } from './lib/passwordAuthGateway'
import { requireUserId } from './lib/requireUserId'
import type { AuthProviderId } from './lib/authProviderIds'

const securityCapabilitiesResolver =
  createSecurityCapabilitiesResolver<AuthProviderId>({
    passwordProviders: ['password'],
  })

export const getSecurityCapabilities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)

    const authMethods: Array<AuthProviderId> = []
    for (const provider of AUTH_PROVIDER_IDS) {
      const account = await ctx.db
        .query('authAccounts')
        .withIndex('userIdAndProvider', (q) =>
          q.eq('userId', userId).eq('provider', provider),
        )
        .unique()

      if (account) {
        authMethods.push(provider)
      }
    }

    return {
      canChangePassword:
        securityCapabilitiesResolver.canChangePasswordForAuthMethods(
          authMethods,
        ),
      authMethods,
    }
  },
})

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    confirmPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const gateway = createPasswordAuthGateway(ctx)
    try {
      return await changePasswordWithGateway({
        userId,
        input: args,
        gateway,
      })
    } catch (error) {
      if (error instanceof PasswordChangeDomainError) {
        throw new ConvexError({
          code: error.code,
          message: error.message,
        })
      }
      throw error
    }
  },
})
