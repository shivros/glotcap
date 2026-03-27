import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { Route as ToolsRoute } from '@/routes/tools'
import { Route as ToolsIndexRoute } from '@/routes/tools.index'
import { Route as ToolsTranscribeRoute } from '@/routes/tools.transcribe'
import { Route as ToolsSrtRoute } from '@/routes/tools.srt'
import { Route as ToolsBilingualRoute } from '@/routes/tools.bilingual'

const authState = vi.hoisted(() => ({
  value: {
    isAuthenticated: true,
    isLoading: false,
  },
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => authState.value,
}))

vi.mock('@/components/tools/media-tool-page', () => ({
  MediaToolPage: ({
    mode,
    title,
  }: {
    mode: string
    title: string
    description: string
  }) => (
    <div data-testid="media-tool-page">
      {mode}:{title}
    </div>
  ),
}))

vi.mock('@/components/ui/spinner', () => ({
  PageSpinner: () => <div data-testid="page-spinner">loading</div>,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate">{to}</div>
    ),
    Outlet: () => <div data-testid="tools-outlet" />,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

const ToolsRouteComponent = ToolsRoute.options.component as ComponentType
const ToolsIndexRouteComponent = ToolsIndexRoute.options
  .component as ComponentType
const ToolsTranscribeComponent = ToolsTranscribeRoute.options
  .component as ComponentType
const ToolsSrtComponent = ToolsSrtRoute.options.component as ComponentType
const ToolsBilingualComponent = ToolsBilingualRoute.options
  .component as ComponentType

describe('tools routes', () => {
  beforeEach(() => {
    authState.value = {
      isAuthenticated: true,
      isLoading: false,
    }
  })

  it('tools index shows spinner while loading auth', () => {
    authState.value = {
      isAuthenticated: false,
      isLoading: true,
    }
    render(<ToolsRouteComponent />)

    expect(screen.getByTestId('page-spinner')).not.toBeNull()
  })

  it('tools index redirects unauthenticated users', () => {
    authState.value = {
      isAuthenticated: false,
      isLoading: false,
    }
    render(<ToolsRouteComponent />)

    expect(screen.getByTestId('navigate').textContent).toBe('/')
  })

  it('tools route renders outlet for authenticated users', () => {
    render(<ToolsRouteComponent />)

    expect(screen.getByTestId('tools-outlet')).not.toBeNull()
  })

  it('tools index renders all tool cards', () => {
    render(<ToolsIndexRouteComponent />)

    expect(screen.getByText('Audio to Transcript')).not.toBeNull()
    expect(screen.getByText('Audio to SRT')).not.toBeNull()
    expect(screen.getByText('Bilingual Subtitles')).not.toBeNull()
  })

  it('transcribe route renders MediaToolPage in transcript mode', () => {
    render(<ToolsTranscribeComponent />)

    expect(screen.getByTestId('media-tool-page').textContent).toContain(
      'transcript',
    )
  })

  it('srt route renders MediaToolPage in srt mode', () => {
    render(<ToolsSrtComponent />)

    expect(screen.getByTestId('media-tool-page').textContent).toContain('srt')
  })

  it('bilingual route renders MediaToolPage in bilingual mode', () => {
    render(<ToolsBilingualComponent />)

    expect(screen.getByTestId('media-tool-page').textContent).toContain(
      'bilingual',
    )
  })
})
