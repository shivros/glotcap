import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMutation } from 'convex/react'
import { useTranslationPersistence } from '../lib/use-translation-persistence'

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    speaking: {
      saveEventTranslation: 'saveEventTranslation',
    },
  },
}))

const mockUseMutation = vi.mocked(useMutation)

const makeFeed = (events: Array<{ _id: string; streamId?: string }>) =>
  events.map((e) => ({
    _id: e._id,
    _creationTime: 0,
    sessionId: 'session-1',
    type: 'transcript' as const,
    speaker: 'user' as const,
    text: '',
    createdAt: 0,
    ...(e.streamId ? { streamId: e.streamId } : {}),
  })) as any

describe('useTranslationPersistence', () => {
  it('persists translation by matching event _id', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-1' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('evt-1', 'Hello')
    })

    expect(saveMutation).toHaveBeenCalledWith({
      eventId: 'evt-1',
      translatedText: 'Hello',
    })
  })

  it('persists translation by matching streamId', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-2', streamId: 'stream-abc' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('stream-abc', 'Bonjour')
    })

    expect(saveMutation).toHaveBeenCalledWith({
      eventId: 'evt-2',
      translatedText: 'Bonjour',
    })
  })

  it('skips duplicate identical writes', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-1' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('evt-1', 'Hello')
      result.current.persist('evt-1', 'Hello')
    })

    expect(saveMutation).toHaveBeenCalledTimes(1)
  })

  it('writes again when translation text changes', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-1' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('evt-1', 'Hello')
      result.current.persist('evt-1', 'Hello world')
    })

    expect(saveMutation).toHaveBeenCalledTimes(2)
  })

  it('does not call mutation when sourceId is not in feed', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-1' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('unknown-id', 'Hello')
    })

    expect(saveMutation).not.toHaveBeenCalled()
  })

  it('does not call mutation when feed is null', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const { result } = renderHook(() => useTranslationPersistence(null))

    act(() => {
      result.current.persist('evt-1', 'Hello')
    })

    expect(saveMutation).not.toHaveBeenCalled()
  })

  it('reset clears dedup cache so subsequent writes go through', () => {
    const saveMutation = vi.fn()
    mockUseMutation.mockReturnValue(saveMutation as any)

    const feed = makeFeed([{ _id: 'evt-1' }])
    const { result } = renderHook(() => useTranslationPersistence(feed))

    act(() => {
      result.current.persist('evt-1', 'Hello')
    })
    expect(saveMutation).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.reset()
    })

    act(() => {
      result.current.persist('evt-1', 'Hello')
    })
    expect(saveMutation).toHaveBeenCalledTimes(2)
  })
})
