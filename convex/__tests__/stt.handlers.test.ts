// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const createSttSessionBootstrapperMock = vi.hoisted(() => vi.fn())

vi.mock('ts-common/speech/stt', () => ({
  createSttSessionBootstrapper: (...args: Array<unknown>) =>
    createSttSessionBootstrapperMock(...args),
}))

describe('createCreateSessionHandler', () => {
  it('records stt session cost for active session', async () => {
    const createConfig = vi.fn(() =>
      Promise.resolve({
        provider: 'deepgram',
        config: { model: 'nova-3' },
      }),
    )
    createSttSessionBootstrapperMock.mockReturnValueOnce(createConfig)

    const { createCreateSessionHandler } = await import('../stt')
    const recordSttSessionCost = vi.fn(() => Promise.resolve())
    const handler = createCreateSessionHandler({
      toolUsageCostService: { recordSttSessionCost } as any,
    })

    const ctx = {
      runQuery: vi.fn(() =>
        Promise.resolve({ status: 'active', userId: 'user_1' }),
      ),
    } as any

    const result = await handler(ctx, {
      sessionId: 'session_1' as any,
      sampleRate: 16000,
      provider: 'deepgram',
    })

    expect(recordSttSessionCost).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        operation: 'stt-session-bootstrap',
        threadId: 'speaking:session_1',
        providerName: 'deepgram',
        modelId: 'nova-3',
      }),
    )
    expect(result).toEqual(expect.objectContaining({ provider: 'deepgram' }))
  })

  it('throws when session is missing', async () => {
    const { createCreateSessionHandler } = await import('../stt')
    const handler = createCreateSessionHandler({
      toolUsageCostService: { recordSttSessionCost: vi.fn() } as any,
    })

    await expect(
      handler({ runQuery: vi.fn(() => Promise.resolve(null)) } as any, {
        sessionId: 'session_1' as any,
        sampleRate: 16000,
      }),
    ).rejects.toThrow('Session not found.')
  })

  it('returns session config even when cost recording fails', async () => {
    const createConfig = vi.fn(() =>
      Promise.resolve({
        provider: 'deepgram',
        config: { model: 'nova-3' },
      }),
    )
    createSttSessionBootstrapperMock.mockReturnValueOnce(createConfig)
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { createCreateSessionHandler } = await import('../stt')
    const handler = createCreateSessionHandler({
      toolUsageCostService: {
        recordSttSessionCost: vi.fn(() =>
          Promise.reject(new Error('cost service down')),
        ),
      } as any,
    })

    const result = await handler(
      {
        runQuery: vi.fn(() =>
          Promise.resolve({ status: 'active', userId: 'user_1' }),
        ),
      } as any,
      {
        sessionId: 'session_1' as any,
        sampleRate: 16000,
        provider: 'deepgram',
      },
    )

    expect(result).toEqual(expect.objectContaining({ provider: 'deepgram' }))
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to record STT session cost',
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })
})
