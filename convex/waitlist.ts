import { createJoinWaitlistMutation } from 'ts-common/waitlist/convex'
import { mutation } from './_generated/server'

export const joinWaitlist = createJoinWaitlistMutation(mutation)
