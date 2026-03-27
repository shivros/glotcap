import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'
import {
  getMyLanguagePreference,
  setMyLanguagePreference,
} from '../userPreferences'

const authState = vi.hoisted(() => ({
  userId: null as string | null,
}))

vi.mock('@convex-dev/auth/server', () => ({
  getAuthUserId: () => Promise.resolve(authState.userId),
}))

type PreferenceDoc = {
  _id: string
  userId: string
  lastSelectedLanguageId: string
  createdAt: number
  updatedAt: number
}

type SessionDoc = {
  _id: string
  userId?: string
  targetLanguage: string
  createdAt: number
}

const createMockDb = ({
  preferences = [],
  sessions = [],
}: {
  preferences?: Array<PreferenceDoc>
  sessions?: Array<SessionDoc>
} = {}) => {
  const preferenceRows = preferences.slice()
  const sessionRows = sessions.slice()
  const deletes: Array<string> = []
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = []
  let idCounter = 0

  const db = {
    query: (table: string) => {
      if (table === 'userPreferences') {
        return {
          withIndex: () => ({
            collect: () => Promise.resolve(preferenceRows.slice()),
          }),
        }
      }
      if (table === 'speakingSessions') {
        return {
          withIndex: () => ({
            order: () => ({
              take: (limit: number) =>
                Promise.resolve(
                  sessionRows
                    .slice()
                    .sort((left, right) => right.createdAt - left.createdAt)
                    .slice(0, limit),
                ),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
    delete: (id: string) => {
      deletes.push(id)
      const index = preferenceRows.findIndex((row) => row._id === id)
      if (index >= 0) {
        preferenceRows.splice(index, 1)
      }
      return Promise.resolve()
    },
    patch: (id: string, patch: Record<string, unknown>) => {
      patches.push({ id, patch })
      const index = preferenceRows.findIndex((row) => row._id === id)
      if (index >= 0) {
        preferenceRows[index] = {
          ...preferenceRows[index],
          ...patch,
        } as PreferenceDoc
      }
      return Promise.resolve()
    },
    insert: (table: string, value: Record<string, unknown>) => {
      inserts.push({ table, value })
      idCounter += 1
      const id = `pref-${idCounter}`
      if (table === 'userPreferences') {
        preferenceRows.push({
          _id: id,
          ...(value as Omit<PreferenceDoc, '_id'>),
        })
      }
      return Promise.resolve(id)
    },
  }

  return {
    db,
    preferenceRows,
    deletes,
    patches,
    inserts,
  }
}

describe('userPreferences', () => {
  beforeEach(() => {
    authState.userId = null
  })

  it('returns unauthenticated response from query when user is missing', async () => {
    const { db } = createMockDb()

    const result = await (getMyLanguagePreference as any)._handler({ db }, {})

    expect(result).toEqual({
      languageId: null,
      isAuthenticated: false,
    })
  })

  it('returns stored language preference when available', async () => {
    authState.userId = 'user-1'
    const { db } = createMockDb({
      preferences: [
        {
          _id: 'pref-1',
          userId: 'user-1',
          lastSelectedLanguageId: 'ru',
          createdAt: 10,
          updatedAt: 20,
        },
      ],
    })

    const result = await (getMyLanguagePreference as any)._handler({ db }, {})

    expect(result).toEqual({
      languageId: 'ru',
      isAuthenticated: true,
    })
  })

  it('falls back to the latest session language when no valid preference exists', async () => {
    authState.userId = 'user-1'
    const { db } = createMockDb({
      preferences: [
        {
          _id: 'pref-1',
          userId: 'user-1',
          lastSelectedLanguageId: 'xx',
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      sessions: [
        {
          _id: 'session-1',
          userId: 'user-1',
          targetLanguage: 'French',
          createdAt: 100,
        },
        {
          _id: 'session-2',
          userId: 'user-1',
          targetLanguage: 'Russian',
          createdAt: 200,
        },
      ],
    })

    const result = await (getMyLanguagePreference as any)._handler({ db }, {})

    expect(result).toEqual({
      languageId: 'ru',
      isAuthenticated: true,
    })
  })

  it('returns null language when fallback session language is unknown', async () => {
    authState.userId = 'user-1'
    const { db } = createMockDb({
      sessions: [
        {
          _id: 'session-1',
          userId: 'user-1',
          targetLanguage: 'Elvish',
          createdAt: 100,
        },
      ],
    })

    const result = await (getMyLanguagePreference as any)._handler({ db }, {})

    expect(result).toEqual({
      languageId: null,
      isAuthenticated: true,
    })
  })

  it('rejects unauthenticated mutation requests', async () => {
    const { db } = createMockDb()

    await expect(
      (setMyLanguagePreference as any)._handler(
        { db },
        {
          languageId: 'ru',
        },
      ),
    ).rejects.toBeInstanceOf(ConvexError)

    await expect(
      (setMyLanguagePreference as any)._handler(
        { db },
        {
          languageId: 'ru',
        },
      ),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    })
  })

  it('rejects invalid language mutation requests', async () => {
    authState.userId = 'user-1'
    const { db } = createMockDb()

    await expect(
      (setMyLanguagePreference as any)._handler(
        { db },
        {
          languageId: 'xx',
        },
      ),
    ).rejects.toMatchObject({
      data: { code: 'INVALID_INPUT' },
    })
  })

  it('inserts a new preference when none exists', async () => {
    authState.userId = 'user-1'
    const { db, inserts, preferenceRows } = createMockDb()
    vi.spyOn(Date, 'now').mockReturnValue(111)

    const result = await (setMyLanguagePreference as any)._handler(
      { db },
      { languageId: 'ja' },
    )

    expect(result).toEqual({
      languageId: 'ja',
      updatedAt: 111,
    })
    expect(inserts).toHaveLength(1)
    expect(preferenceRows[0]?.lastSelectedLanguageId).toBe('ja')
    vi.restoreAllMocks()
  })

  it('patches existing preference when language changes', async () => {
    authState.userId = 'user-1'
    const { db, patches, preferenceRows } = createMockDb({
      preferences: [
        {
          _id: 'pref-1',
          userId: 'user-1',
          lastSelectedLanguageId: 'fr',
          createdAt: 10,
          updatedAt: 20,
        },
      ],
    })
    vi.spyOn(Date, 'now').mockReturnValue(222)

    const result = await (setMyLanguagePreference as any)._handler(
      { db },
      { languageId: 'ru' },
    )

    expect(result).toEqual({
      languageId: 'ru',
      updatedAt: 222,
    })
    expect(patches).toHaveLength(1)
    expect(preferenceRows[0]?.lastSelectedLanguageId).toBe('ru')
    vi.restoreAllMocks()
  })

  it('does not patch when language remains unchanged', async () => {
    authState.userId = 'user-1'
    const { db, patches } = createMockDb({
      preferences: [
        {
          _id: 'pref-1',
          userId: 'user-1',
          lastSelectedLanguageId: 'ru',
          createdAt: 10,
          updatedAt: 77,
        },
      ],
    })

    const result = await (setMyLanguagePreference as any)._handler(
      { db },
      { languageId: 'ru' },
    )

    expect(result).toEqual({
      languageId: 'ru',
      updatedAt: 77,
    })
    expect(patches).toHaveLength(0)
  })

  it('cleans up stale duplicate preference rows', async () => {
    authState.userId = 'user-1'
    const { db, deletes } = createMockDb({
      preferences: [
        {
          _id: 'pref-old',
          userId: 'user-1',
          lastSelectedLanguageId: 'fr',
          createdAt: 10,
          updatedAt: 10,
        },
        {
          _id: 'pref-new',
          userId: 'user-1',
          lastSelectedLanguageId: 'ru',
          createdAt: 20,
          updatedAt: 20,
        },
      ],
    })

    const result = await (setMyLanguagePreference as any)._handler(
      { db },
      { languageId: 'ru' },
    )

    expect(result).toEqual({
      languageId: 'ru',
      updatedAt: 20,
    })
    expect(deletes).toEqual(['pref-old'])
  })
})
