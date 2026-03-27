// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import { PasswordChangeDomainError } from 'ts-common/convex/password-change-service'

const requireUserIdMock = vi.fn()
const changePasswordWithGatewayMock = vi.fn()
const createPasswordAuthGatewayMock = vi.fn()

vi.mock('../_generated/server', () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
  action: (definition: unknown) => definition,
}))

vi.mock('../_generated/api', () => ({
  internal: {
    accountSecurityInternal: {
      getPasswordAccountByUser: 'getPasswordAccountByUserRef',
    },
  },
}))

vi.mock('../lib/requireUserId', () => ({
  requireUserId: (...args: Array<unknown>) => requireUserIdMock(...args),
}))

vi.mock('../lib/passwordAuthGateway', () => ({
  createPasswordAuthGateway: (...args: Array<unknown>) =>
    createPasswordAuthGatewayMock(...args),
}))

vi.mock('ts-common/convex/password-change-service', async () => {
  const actual = await vi.importActual(
    'ts-common/convex/password-change-service',
  )
  return {
    ...actual,
    changePasswordWithGateway: (...args: Array<unknown>) =>
      changePasswordWithGatewayMock(...args),
  }
})

describe('accountSecurity handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSecurityCapabilities', () => {
    it('reports canChangePassword true when password account exists', async () => {
      requireUserIdMock.mockResolvedValue('user123')
      const { getSecurityCapabilities } =
        (await import('../accountSecurity')) as any

      const uniqueMock = vi
        .fn()
        .mockResolvedValueOnce({ providerAccountId: 'email@test.com' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const mockDb = {
        query: () => ({
          withIndex: () => ({
            unique: uniqueMock,
          }),
        }),
      }

      const result = await getSecurityCapabilities.handler(
        { db: mockDb } as never,
        {},
      )
      expect(result.canChangePassword).toBe(true)
      expect(result.authMethods).toContain('password')
    })

    it('reports canChangePassword false for OAuth-only accounts', async () => {
      requireUserIdMock.mockResolvedValue('user123')
      const { getSecurityCapabilities } =
        (await import('../accountSecurity')) as any

      const uniqueMock = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ providerAccountId: 'gh-123' })
        .mockResolvedValueOnce(null)

      const mockDb = {
        query: () => ({
          withIndex: () => ({
            unique: uniqueMock,
          }),
        }),
      }

      const result = await getSecurityCapabilities.handler(
        { db: mockDb } as never,
        {},
      )
      expect(result.canChangePassword).toBe(false)
      expect(result.authMethods).not.toContain('password')
      expect(result.authMethods).toContain('github')
    })
  })

  describe('changePassword', () => {
    it('wraps PasswordChangeDomainError as ConvexError', async () => {
      requireUserIdMock.mockResolvedValue('user123')
      createPasswordAuthGatewayMock.mockReturnValue({})
      changePasswordWithGatewayMock.mockRejectedValue(
        new PasswordChangeDomainError(
          'INVALID_CURRENT_PASSWORD',
          'Current password is incorrect.',
        ),
      )

      const { changePassword } = (await import('../accountSecurity')) as any

      await expect(
        changePassword.handler({} as never, {
          currentPassword: 'wrong',
          newPassword: 'new-password-123',
          confirmPassword: 'new-password-123',
        }),
      ).rejects.toThrow(ConvexError)
    })

    it('rethrows non-domain errors unchanged', async () => {
      requireUserIdMock.mockResolvedValue('user123')
      createPasswordAuthGatewayMock.mockReturnValue({})
      changePasswordWithGatewayMock.mockRejectedValue(
        new Error('Unexpected failure'),
      )

      const { changePassword } = (await import('../accountSecurity')) as any

      await expect(
        changePassword.handler({} as never, {
          currentPassword: 'current',
          newPassword: 'new-password-123',
          confirmPassword: 'new-password-123',
        }),
      ).rejects.toThrow('Unexpected failure')
    })

    it('returns success result on valid change', async () => {
      requireUserIdMock.mockResolvedValue('user123')
      createPasswordAuthGatewayMock.mockReturnValue({})
      changePasswordWithGatewayMock.mockResolvedValue({
        status: 'password_changed',
      })

      const { changePassword } = (await import('../accountSecurity')) as any

      const result = await changePassword.handler({} as never, {
        currentPassword: 'current',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      })
      expect(result).toEqual({ status: 'password_changed' })
    })
  })
})
