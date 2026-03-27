import type { Resend } from '@convex-dev/resend'
import type { EmailMessage, EmailSender } from '../email'

export class ResendEmailSender<TCtx = unknown> implements EmailSender<TCtx> {
  constructor(private readonly resend: Resend | (() => Resend)) {}

  async send(ctx: TCtx, message: EmailMessage) {
    const resend =
      typeof this.resend === 'function' ? this.resend() : this.resend
    const replyTo = message.replyTo
      ? Array.isArray(message.replyTo)
        ? message.replyTo
        : [message.replyTo]
      : undefined
    const headers = message.headers
      ? Object.entries(message.headers).map(([name, value]) => ({
          name,
          value,
        }))
      : undefined

    await resend.sendEmail(ctx as never, {
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo,
      headers,
    })
  }
}
