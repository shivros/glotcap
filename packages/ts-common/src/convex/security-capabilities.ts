export const DEFAULT_SECURITY_AUTH_PROVIDERS = [
  'password',
  'github',
  'google',
] as const

export const SECURITY_AUTH_PROVIDERS = DEFAULT_SECURITY_AUTH_PROVIDERS

export type SecurityAuthProvider =
  (typeof DEFAULT_SECURITY_AUTH_PROVIDERS)[number]

export type SecurityCapabilities<
  TProvider extends string = SecurityAuthProvider,
> = {
  canChangePassword: boolean
  authMethods: Array<TProvider>
}

export type SecurityCapabilitiesResolver<TProvider extends string> = {
  canChangePasswordForAuthMethods: (
    authMethods: ReadonlyArray<TProvider>,
  ) => boolean
  getCapabilities: (
    authMethods: ReadonlyArray<TProvider>,
  ) => SecurityCapabilities<TProvider>
}

export function createSecurityCapabilitiesResolver<TProvider extends string>({
  passwordProviders = ['password' as TProvider],
}: {
  passwordProviders?: ReadonlyArray<TProvider>
} = {}): SecurityCapabilitiesResolver<TProvider> {
  const passwordProviderSet = new Set(passwordProviders)

  function hasPasswordChangeCapability(authMethods: ReadonlyArray<TProvider>) {
    return authMethods.some((provider) => passwordProviderSet.has(provider))
  }

  function getCapabilities(
    authMethods: ReadonlyArray<TProvider>,
  ): SecurityCapabilities<TProvider> {
    return {
      canChangePassword: hasPasswordChangeCapability(authMethods),
      authMethods: [...authMethods],
    }
  }

  return {
    canChangePasswordForAuthMethods: hasPasswordChangeCapability,
    getCapabilities,
  }
}

const defaultResolver =
  createSecurityCapabilitiesResolver<SecurityAuthProvider>({
    passwordProviders: ['password'],
  })

export function canChangePasswordForAuthMethods(
  authMethods: ReadonlyArray<SecurityAuthProvider>,
) {
  return defaultResolver.canChangePasswordForAuthMethods(authMethods)
}
