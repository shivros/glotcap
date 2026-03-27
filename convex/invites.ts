import {
  createConsumeInviteMutation,
  createSignupInviteMutation,
  createValidateInviteQuery,
} from 'ts-common/invites/convex'
import { internalMutation, mutation, query } from './_generated/server'

export const createInvite = createSignupInviteMutation(internalMutation)
export const validateInvite = createValidateInviteQuery(query)
export const consumeInvite = createConsumeInviteMutation(mutation)
