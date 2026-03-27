export const AUTH_PROVIDER_IDS = ['password', 'github', 'google'] as const

export type AuthProviderId = (typeof AUTH_PROVIDER_IDS)[number]
