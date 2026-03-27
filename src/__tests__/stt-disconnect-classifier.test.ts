import { describe, expect, it, vi } from 'vitest'
import { createDefaultSttDisconnectClassifier } from '@/lib/stt/default-disconnect-classifier'

describe('createDefaultSttDisconnectClassifier', () => {
  it('ignores non-actionable disconnects', () => {
    const classifier = createDefaultSttDisconnectClassifier()
    const reconnectStrategy = {
      shouldRetry: vi.fn(() => true),
      getDelayMs: vi.fn(() => 10),
    }

    expect(
      classifier.classify({
        attempt: 1,
        reason: 'close',
        error: new Error('closed'),
        closeInfo: null,
        explicitStop: true,
        isConnectionStale: false,
        isConnectionCurrent: true,
        reconnectStrategy,
      }),
    ).toBe('ignore')

    expect(
      classifier.classify({
        attempt: 1,
        reason: 'close',
        error: new Error('closed'),
        closeInfo: null,
        explicitStop: false,
        isConnectionStale: true,
        isConnectionCurrent: true,
        reconnectStrategy,
      }),
    ).toBe('ignore')
  })

  it('delegates retry/fail decisions to reconnect strategy', () => {
    const classifier = createDefaultSttDisconnectClassifier()
    const retryStrategy = {
      shouldRetry: vi.fn(() => true),
      getDelayMs: vi.fn(() => 10),
    }

    expect(
      classifier.classify({
        attempt: 2,
        reason: 'error',
        error: new Error('temporary'),
        closeInfo: null,
        explicitStop: false,
        isConnectionStale: false,
        isConnectionCurrent: true,
        reconnectStrategy: retryStrategy,
      }),
    ).toBe('retry')

    const failStrategy = {
      shouldRetry: vi.fn(() => false),
      getDelayMs: vi.fn(() => 10),
    }

    expect(
      classifier.classify({
        attempt: 3,
        reason: 'error',
        error: new Error('terminal'),
        closeInfo: null,
        explicitStop: false,
        isConnectionStale: false,
        isConnectionCurrent: true,
        reconnectStrategy: failStrategy,
      }),
    ).toBe('fail')
  })
})
