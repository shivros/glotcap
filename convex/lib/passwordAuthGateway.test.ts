// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const retrieveAccountMock = vi.fn()
const modifyAccountCredentialsMock = vi.fn()
const invalidateSessionsMock = vi.fn()
const getAuthSessionIdMock = vi.fn()

vi.mock('@convex-dev/auth/server', () => ({
  retrieveAccount: (...args: Array<unknown>) => retrieveAccountMock(...args),
  modifyAccountCredentials: (...args: Array<unknown>) =>
    modifyAccountCredentialsMock(...args),
  invalidateSessions: (...args: Array<unknown>) =>
    invalidateSessionsMock(...args),
  getAuthSessionId: (...args: Array<unknown>) => getAuthSessionIdMock(...args),
}))

vi.mock('../_generated/api', () => ({
  internal: {
    accountSecurityInternal: {
      getPasswordAccountByUser:
        'accountSecurityInternal:getPasswordAccountByUser',
    },
  },
}))

describe('createPasswordAuthGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the password account identifier when present', async () => {
    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = {
      runQuery: vi.fn(() =>
        Promise.resolve({ providerAccountId: 'user@example.com' }),
      ),
    }

    const gateway = createPasswordAuthGateway(ctx as never)
    const result = await gateway.getPasswordAccountIdentifier('user_1' as never)

    expect(result).toBe('user@example.com')
    expect(ctx.runQuery).toHaveBeenCalledWith(
      'accountSecurityInternal:getPasswordAccountByUser',
      { userId: 'user_1' },
    )
  })

  it('returns null when no password account exists', async () => {
    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = {
      runQuery: vi.fn(() => Promise.resolve(null)),
    }

    const gateway = createPasswordAuthGateway(ctx as never)
    const result = await gateway.getPasswordAccountIdentifier('user_1' as never)

    expect(result).toBeNull()
  })

  it('verifies the current password for the same user', async () => {
    retrieveAccountMock.mockResolvedValue({ user: { _id: 'user_1' } })

    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = {
      runQuery: vi.fn(),
    }

    const gateway = createPasswordAuthGateway(ctx as never)
    const result = await gateway.verifyCurrentPassword({
      userId: 'user_1' as never,
      providerAccountId: 'user@example.com',
      currentPassword: 'old-password', // pragma: allowlist secret
    })

    expect(result).toBe('valid')
    expect(retrieveAccountMock).toHaveBeenCalledWith(ctx, {
      provider: 'password',
      account: {
        id: 'user@example.com',
        secret: 'old-password',
      },
    })
  })

  it('returns invalid when retrieved account belongs to another user', async () => {
    retrieveAccountMock.mockResolvedValue({ user: { _id: 'user_2' } })

    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const gateway = createPasswordAuthGateway({ runQuery: vi.fn() } as never)

    const result = await gateway.verifyCurrentPassword({
      userId: 'user_1' as never,
      providerAccountId: 'user@example.com',
      currentPassword: 'old-password',
    })

    expect(result).toBe('invalid')
  })

  it('returns invalid for invalid credential errors', async () => {
    retrieveAccountMock.mockRejectedValue(new Error('Invalid credentials'))

    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const gateway = createPasswordAuthGateway({ runQuery: vi.fn() } as never)

    const result = await gateway.verifyCurrentPassword({
      userId: 'user_1' as never,
      providerAccountId: 'user@example.com',
      currentPassword: 'bad-password', // pragma: allowlist secret
    })

    expect(result).toBe('invalid')
  })

  it('rethrows non-credential verification errors', async () => {
    retrieveAccountMock.mockRejectedValue(new Error('database unavailable'))

    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const gateway = createPasswordAuthGateway({ runQuery: vi.fn() } as never)

    await expect(
      gateway.verifyCurrentPassword({
        userId: 'user_1' as never,
        providerAccountId: 'user@example.com',
        currentPassword: 'bad-password',
      }),
    ).rejects.toThrow('database unavailable')
  })

  it('updates password with the explicit password provider', async () => {
    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = { runQuery: vi.fn() }
    const gateway = createPasswordAuthGateway(ctx as never)

    await gateway.updatePassword({
      providerAccountId: 'user@example.com',
      newPassword: 'new-password-123', // pragma: allowlist secret
    })

    expect(modifyAccountCredentialsMock).toHaveBeenCalledWith(ctx, {
      provider: 'password',
      account: {
        id: 'user@example.com',
        secret: 'new-password-123',
      },
    })
  })

  it('returns the current auth session id', async () => {
    getAuthSessionIdMock.mockResolvedValue('session_1')

    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const gateway = createPasswordAuthGateway({ runQuery: vi.fn() } as never)

    await expect(gateway.getCurrentSessionId()).resolves.toBe('session_1')
  })

  it('invalidates other sessions while preserving current session', async () => {
    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = { runQuery: vi.fn() }
    const gateway = createPasswordAuthGateway(ctx as never)

    await gateway.invalidateOtherSessions({
      userId: 'user_1' as never,
      currentSessionId: 'session_1' as never,
    })

    expect(invalidateSessionsMock).toHaveBeenCalledWith(ctx, {
      userId: 'user_1',
      except: ['session_1'],
    })
  })

  it('invalidates all sessions when there is no current session id', async () => {
    const { createPasswordAuthGateway } = await import('./passwordAuthGateway')
    const ctx = { runQuery: vi.fn() }
    const gateway = createPasswordAuthGateway(ctx as never)

    await gateway.invalidateOtherSessions({
      userId: 'user_1' as never,
      currentSessionId: null,
    })

    expect(invalidateSessionsMock).toHaveBeenCalledWith(ctx, {
      userId: 'user_1',
      except: undefined,
    })
  })
})
