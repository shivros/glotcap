import { convexAuth } from '@convex-dev/auth/server'
import GitHub from '@auth/core/providers/github'
import Google from '@auth/core/providers/google'
import { Password } from '@convex-dev/auth/providers/Password'
import { verificationEmailProvider } from './emails'

type Env = Record<string, string | undefined>

const env = (globalThis as { process?: { env?: Env } }).process?.env ?? {}
const allowTestEmailVerification = resolveTestMode(env)

const buildPasswordProfile = (params: Record<string, unknown>) => {
  const email = params.email as string
  const emailVerified =
    allowTestEmailVerification && params.emailVerified === true
  return {
    email,
    ...(emailVerified ? { emailVerified: true } : {}),
  }
}

/**
 * GlotCap authentication configuration.
 *
 * Supports:
 * - Email/password authentication
 * - GitHub OAuth
 * - Google OAuth
 *
 * Environment variables required (set via `bunx convex env set`):
 * - AUTH_GITHUB_ID
 * - AUTH_GITHUB_SECRET
 * - AUTH_GOOGLE_ID
 * - AUTH_GOOGLE_SECRET
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    verificationEmailProvider,
    Password({
      verify: verificationEmailProvider,
      profile: buildPasswordProfile,
    }),
    GitHub,
    Google,
  ],
})

function resolveTestMode(currentEnv: Env) {
  const raw = currentEnv.RESEND_TEST_MODE
  if (raw === undefined) {
    return currentEnv.NODE_ENV !== 'production'
  }
  return raw !== 'false' && raw !== '0'
}
