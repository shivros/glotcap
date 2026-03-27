import { Resend } from '@convex-dev/resend'
import { ResendEmailSender } from 'ts-common/convex/email'
import { createVerificationEmailProvider } from 'ts-common/auth/providers/convex/server'
import { components } from './_generated/api'

type Env = Record<string, string | undefined>

const env = (globalThis as { process?: { env?: Env } }).process?.env ?? {}
const appName = 'GlotCap'
const from = env.RESEND_FROM ?? `${appName} <onboarding@resend.dev>`
const testMode = resolveTestMode(env)

export const resend = new Resend(components.resend, {
  testMode,
})

const sender = new ResendEmailSender(resend)

export const verificationEmailProvider = createVerificationEmailProvider({
  sender,
  appName,
  from,
})

function resolveTestMode(currentEnv: Env) {
  const raw = currentEnv.RESEND_TEST_MODE
  if (raw === undefined) {
    return currentEnv.NODE_ENV !== 'production'
  }
  return raw !== 'false' && raw !== '0'
}
