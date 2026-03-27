import type {
  EmailConfig,
  GenericActionCtxWithAuthConfig,
} from '@convex-dev/auth/server'
import type { GenericDataModel } from 'convex/server'
import type { EmailSender } from '../../../../email'

export type VerificationEmailTemplateInput = {
  appName: string
  actionUrl: string
  expires: Date
  recipient: string
}

export type VerificationEmailTemplate = (
  input: VerificationEmailTemplateInput,
) => {
  subject: string
  html: string
  text: string
}

export type VerificationEmailProviderOptions<
  TDataModel extends GenericDataModel = GenericDataModel,
> = {
  sender: EmailSender<GenericActionCtxWithAuthConfig<TDataModel>>
  appName: string
  from: string | (() => string)
  template?: VerificationEmailTemplate
  id?: string
  name?: string
  maxAgeSeconds?: number
}

export function createVerificationEmailProvider<
  TDataModel extends GenericDataModel,
>({
  sender,
  appName,
  from,
  template = buildVerificationEmailTemplate,
  id = 'resend',
  name,
  maxAgeSeconds = 60 * 60,
}: VerificationEmailProviderOptions<TDataModel>): EmailConfig<TDataModel> {
  type VerificationRequestParams = Parameters<
    EmailConfig<TDataModel>['sendVerificationRequest']
  >[0]
  const resolveFrom = () => (typeof from === 'function' ? from() : from)

  return {
    id,
    type: 'email',
    name: name ?? `${appName} Email`,
    from: resolveFrom(),
    maxAge: maxAgeSeconds,
    authorize: undefined,
    sendVerificationRequest: async function (
      params: VerificationRequestParams,
    ) {
      const ctx = (arguments[1] ??
        null) as GenericActionCtxWithAuthConfig<TDataModel> | null
      if (!ctx) {
        throw new Error('Verification email context is missing.')
      }
      const message = template({
        appName,
        actionUrl: params.url,
        expires: params.expires,
        recipient: params.identifier,
      })
      const emailFrom = resolveFrom()

      await sender.send(ctx, {
        to: params.identifier,
        from: emailFrom,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
    },
  }
}

export function buildVerificationEmailTemplate({
  appName,
  actionUrl,
  expires,
  recipient,
}: VerificationEmailTemplateInput) {
  const safeAppName = escapeHtml(appName)
  const safeRecipient = escapeHtml(recipient)
  const safeUrl = escapeHtml(actionUrl)
  const expiresAt = expires.toUTCString()

  const subject = `Confirm your ${safeAppName} email`
  const text = [
    `Confirm your email for ${appName}.`,
    '',
    `Email: ${recipient}`,
    `Verification link: ${actionUrl}`,
    `This link expires at ${expiresAt}.`,
  ].join('\n')

  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f1b22;">',
    `  <h2 style="margin:0 0 12px;">Confirm your ${safeAppName} email</h2>`,
    `  <p style="margin:0 0 12px;">We received a request to verify <strong>${safeRecipient}</strong>.</p>`,
    `  <p style="margin:0 0 16px;"><a href="${safeUrl}" style="background:#ff6b3d;color:#ffffff;padding:10px 16px;border-radius:999px;text-decoration:none;display:inline-block;">Verify email</a></p>`,
    `  <p style="margin:0 0 12px;">This link expires at ${escapeHtml(
      expiresAt,
    )}.</p>`,
    '  <p style="margin:0;color:#6b6770;font-size:12px;">If you did not request this, you can ignore this email.</p>',
    '</div>',
  ].join('')

  return { subject, html, text }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
