/**
 * Convex server-side auth exports.
 */
export { requireConvexUser, getConvexUser } from './middleware'
export {
  buildVerificationEmailTemplate,
  createVerificationEmailProvider,
} from './verification-email'
export type {
  VerificationEmailProviderOptions,
  VerificationEmailTemplate,
  VerificationEmailTemplateInput,
} from './verification-email'
export type { IAuthUser } from '../../../core'
