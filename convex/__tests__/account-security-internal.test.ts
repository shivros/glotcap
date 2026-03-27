// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../_generated/server', () => ({
  internalQuery: (definition: unknown) => definition,
}))

describe('accountSecurityInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns providerAccountId when password account exists', async () => {
    const { getPasswordAccountByUser } =
      (await import('../accountSecurityInternal')) as any

    const mockDb = {
      query: () => ({
        withIndex: () => ({
          unique: vi
            .fn()
            .mockResolvedValue({ providerAccountId: 'user@example.com' }),
        }),
      }),
    }

    const result = await getPasswordAccountByUser.handler(
      { db: mockDb } as never,
      { userId: 'user_1' as never },
    )

    expect(result).toEqual({ providerAccountId: 'user@example.com' })
  })

  it('returns null when no password account exists', async () => {
    const { getPasswordAccountByUser } =
      (await import('../accountSecurityInternal')) as any

    const mockDb = {
      query: () => ({
        withIndex: () => ({
          unique: vi.fn().mockResolvedValue(null),
        }),
      }),
    }

    const result = await getPasswordAccountByUser.handler(
      { db: mockDb } as never,
      { userId: 'user_1' as never },
    )

    expect(result).toBeNull()
  })
})
