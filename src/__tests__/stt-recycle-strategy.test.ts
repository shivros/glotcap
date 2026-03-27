import { describe, expect, it } from 'vitest'
import type { RuntimeSttConfig } from 'ts-common/speech/stt'
import { createDefaultSttRecycleStrategy } from '@/lib/stt/default-recycle-strategy'

const baseConfig: RuntimeSttConfig = {
  provider: 'soniox',
  url: 'wss://stt.example.test',
  config: {
    api_key: 'temp-key',
    model: 'stt-rt-preview-v2',
    audio_format: 'pcm_s16le',
    sample_rate: 16000,
  },
  expiresAt: null,
}

describe('createDefaultSttRecycleStrategy', () => {
  it('uses token TTL when available', () => {
    const strategy = createDefaultSttRecycleStrategy()
    const now = Date.parse('2026-02-27T00:00:00Z')
    const schedule = strategy.getSchedule({
      config: {
        ...baseConfig,
        expiresAt: now + 60_000,
      },
      now,
    })

    expect(schedule.ttlMs).toBe(60_000)
    expect(schedule.delayMs).toBe(50_000)
  })

  it('falls back to default recycle window when no TTL is available', () => {
    const strategy = createDefaultSttRecycleStrategy()
    const schedule = strategy.getSchedule({
      config: baseConfig,
      now: Date.now(),
    })

    expect(schedule.ttlMs).toBeNull()
    expect(schedule.delayMs).toBe(240_000)
  })
})
