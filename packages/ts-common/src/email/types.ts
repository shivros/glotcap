export type EmailRecipient = string | Array<string>

export type EmailMessage = {
  to: EmailRecipient
  from: string
  subject: string
  html: string
  text?: string
  replyTo?: EmailRecipient
  headers?: Record<string, string>
}

export interface EmailSender<TCtx = unknown> {
  send: (ctx: TCtx, message: EmailMessage) => Promise<void>
}
