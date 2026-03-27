// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createConvexPasswordResetStoreMock = vi.fn()
const createPasswordResetServiceMock = vi.fn()

vi.mock('ts-common/convex/password-reset-convex-adapters', () => ({
  createConvexPasswordResetStore: (...args: Array<unknown>) =>
    createConvexPasswordResetStoreMock(...args),
}))

vi.mock('ts-common/convex/password-reset-service', () => ({
  createPasswordResetService: (...args: Array<unknown>) =>
    createPasswordResetServiceMock(...args),
}))

describe('createPasswordResetMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createConvexPasswordResetStoreMock.mockReturnValue('store')
    createPasswordResetServiceMock.mockReturnValue('service')
  })

  it('composes the convex store and password reset service', async () => {
    const { createPasswordResetMutationService } =
      await import('./passwordResetAdapters')
    const ctx = { db: { tag: 'db' } }

    const result = createPasswordResetMutationService(ctx as never)

    expect(createConvexPasswordResetStoreMock).toHaveBeenCalledWith(ctx.db)
    expect(createPasswordResetServiceMock).toHaveBeenCalledWith({
      store: 'store',
    })
    expect(result).toBe('service')
  })
})
