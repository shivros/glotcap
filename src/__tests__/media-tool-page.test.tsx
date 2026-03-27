import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaToolPage } from '@/components/tools/media-tool-page'

const authState = vi.hoisted(() => ({
  value: {
    isAuthenticated: true,
    isLoading: false,
  },
}))

const controllerState = vi.hoisted(() => ({
  value: {
    file: null as File | null,
    setFile: vi.fn(),
    sourceLanguage: '',
    setSourceLanguage: vi.fn(),
    targetLanguage: 'en',
    setTargetLanguage: vi.fn(),
    delimiter: '---',
    setDelimiter: vi.fn(),
    bilingualOutput: 'both' as 'transcript' | 'srt' | 'both',
    setBilingualOutput: vi.fn(),
    localError: null as string | null,
    isSubmitting: false,
    submit: vi.fn(async () => {}),
    job: null as any,
    isProcessing: false,
    primaryOutput: '',
    primaryOutputName: 'out.txt',
  },
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => authState.value,
}))

vi.mock('@/lib/tools/use-media-tool-controller', () => ({
  useMediaToolController: () => controllerState.value,
}))

vi.mock('@/components/ui/spinner', () => ({
  PageSpinner: () => <div data-testid="page-spinner">loading</div>,
  Spinner: () => <div data-testid="spinner">spinner</div>,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate">{to}</div>
    ),
  }
})

describe('MediaToolPage', () => {
  beforeEach(() => {
    authState.value = { isAuthenticated: true, isLoading: false }
    controllerState.value.localError = null
    controllerState.value.job = null
    controllerState.value.primaryOutput = ''
    controllerState.value.isProcessing = false
  })

  it('renders spinner while auth is loading', () => {
    authState.value = { isAuthenticated: false, isLoading: true }

    render(
      <MediaToolPage
        mode="transcript"
        title="Audio to Transcript"
        description="desc"
      />,
    )

    expect(screen.getByTestId('page-spinner')).not.toBeNull()
  })

  it('redirects when unauthenticated', () => {
    authState.value = { isAuthenticated: false, isLoading: false }

    render(
      <MediaToolPage
        mode="transcript"
        title="Audio to Transcript"
        description="desc"
      />,
    )

    expect(screen.getByTestId('navigate').textContent).toBe('/')
  })

  it('renders title, description and error state', () => {
    controllerState.value.localError = 'Upload failed.'

    render(
      <MediaToolPage
        mode="transcript"
        title="Audio to Transcript"
        description="Generate transcript"
      />,
    )

    expect(screen.getByText('Audio to Transcript')).not.toBeNull()
    expect(screen.getByText('Generate transcript')).not.toBeNull()
    expect(screen.getByText('Upload failed.')).not.toBeNull()
  })

  it('renders output textarea when primary output exists', () => {
    controllerState.value.primaryOutput = 'hello world'
    controllerState.value.job = {
      status: 'completed',
      updatedAt: Date.now(),
    }

    render(
      <MediaToolPage
        mode="srt"
        title="Audio to SRT"
        description="Generate srt"
      />,
    )

    const textarea = screen.getByDisplayValue('hello world')
    expect(textarea).not.toBeNull()
  })
})
