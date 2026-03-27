import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import { LearningInsightsPage } from '@/components/learning-insights-page'

const testState = vi.hoisted(() => ({
  languagePreference: {
    languageId: 'ru',
    setLanguageId: vi.fn(),
    isHydratingLanguagePreference: false,
  },
  query: vi.fn(),
  mutation: vi.fn(async () => {}),
}))

vi.mock('@/lib/use-user-language-preference', () => ({
  useUserLanguagePreference: () => testState.languagePreference,
}))

vi.mock('convex/react', () => ({
  useQuery: (queryRef: unknown, args: unknown) =>
    testState.query(queryRef, args),
  useMutation: () => testState.mutation,
}))

vi.mock('@/components/ui/spinner', () => ({
  PageSpinner: () => <div data-testid="page-spinner">loading</div>,
}))

vi.mock('@/components/account-menu', () => ({
  AccountMenu: ({ extraContent }: { extraContent?: React.ReactNode }) => (
    <div data-testid="account-menu">{extraContent}</div>
  ),
}))

describe('LearningInsightsPage language hydration', () => {
  beforeEach(() => {
    testState.languagePreference = {
      languageId: 'ru',
      setLanguageId: vi.fn(),
      isHydratingLanguagePreference: false,
    }
    testState.query.mockReset()
    testState.mutation.mockClear()
  })

  it('skips insights query while language preference is hydrating', () => {
    testState.languagePreference.isHydratingLanguagePreference = true
    testState.query.mockReturnValue(undefined)

    render(<LearningInsightsPage />)

    expect(testState.query).toHaveBeenCalledWith(
      api.learningInsights.listLearningInsights,
      'skip',
    )
    expect(screen.getByTestId('page-spinner')).not.toBeNull()
  })

  it('queries insights with resolved language when hydration is complete', () => {
    testState.languagePreference.isHydratingLanguagePreference = false
    testState.query.mockReturnValue([])

    render(<LearningInsightsPage />)

    expect(testState.query).toHaveBeenCalledWith(
      api.learningInsights.listLearningInsights,
      {
        language: 'Russian',
        includeRejected: false,
      },
    )
  })
})
