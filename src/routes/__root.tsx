import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ConvexReactClient, useMutation } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { UnderConstruction } from 'ts-common/flags/components'
import { VercelToolbar } from 'ts-common/vercel/toolbar'

import AppLogsPanel from 'ts-common/logging/devtools'
import TaskErrorsPanel from 'ts-common/task-errors/devtools'
import { api } from '../../convex/_generated/api'
import { isUnderConstruction } from '../lib/flags'
import appCss from '../styles.css?url'
import { toAppError } from '@/lib/errors'
import { logAppError } from '@/lib/logging'
import { cn } from '@/lib/utils'
import { AppPageContainer, AppSurface } from '@/components/app-surface'
import { Button } from '@/components/ui/button'
import {
  APP_PANEL_CLASS,
  APP_TEXT_LABEL_CLASS,
  APP_TEXT_MUTED_CLASS,
} from '@/theme/semantic'

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL as string
if (!convexUrl) {
  throw new Error('Missing VITE_CONVEX_URL environment variable')
}
const convex = new ConvexReactClient(convexUrl)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'GlotCap',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  loader: async () => {
    const underConstruction = await isUnderConstruction()
    const vercelEnv = process.env.VERCEL_ENV ?? null
    return {
      flags: { underConstruction },
      vercel: {
        env: vercelEnv,
        toolbarEnabled: vercelEnv !== null && vercelEnv !== 'production',
      },
    }
  },

  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootErrorComponent,
})

function RootComponent() {
  const { flags } = Route.useLoaderData()

  if (flags.underConstruction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <UnderConstruction />
      </div>
    )
  }

  return <Outlet />
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const data = Route.useLoaderData()

  const devtoolsPlugins = [
    {
      name: 'Tanstack Router',
      render: <TanStackRouterDevtoolsPanel />,
    },
    ...(import.meta.env.DEV
      ? [
          {
            name: 'App Logs',
            render: <AppLogsPanel query={api.logging.listRecent} />,
          },
          {
            name: 'Task Errors',
            render: <TaskErrorsPanel query={api.taskErrors.listRecent} />,
          },
        ]
      : []),
  ]

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexAuthProvider client={convex}>
          {children}
          <ClientOnly>
            <VercelToolbar enable={data.vercel.toolbarEnabled} />
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={devtoolsPlugins}
            />
          </ClientOnly>
        </ConvexAuthProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset?: () => void
}) {
  const logEventMutation = useMutation(api.logging.logEvent)
  const appError = toAppError(error, {
    message: 'Unexpected error.',
    source: 'unknown',
  })

  useEffect(() => {
    void logAppError(logEventMutation, appError, {
      feature: 'router',
      action: 'root-error',
    })
  }, [appError, logEventMutation])

  const message = appError.message

  const handleRetry = () => {
    if (typeof reset === 'function') {
      reset()
      return
    }

    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <AppSurface>
      <AppPageContainer className="min-h-screen items-center justify-center">
        <div
          className={cn(
            'w-full max-w-lg rounded-3xl border p-6 shadow-lg',
            APP_PANEL_CLASS,
          )}
        >
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.3em]',
              APP_TEXT_LABEL_CLASS,
            )}
          >
            GlotCap
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
          <p className={cn('mt-2 text-sm', APP_TEXT_MUTED_CLASS)}>{message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleRetry}>Try again</Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign('/')}
            >
              Back home
            </Button>
          </div>
        </div>
      </AppPageContainer>
    </AppSurface>
  )
}
