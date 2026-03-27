import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { CheckCircle, KeyRound, XCircle } from 'lucide-react'
import { usePasswordResetForm } from 'ts-common/convex/password-reset-hooks'

import { api } from '../../convex/_generated/api'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APP_BRAND_SURFACE_CLASS, APP_PANEL_CLASS } from '@/theme/semantic'
import { cn } from '@/lib/utils'
import { toGlotcapConvexErrorMessage } from '@/lib/convex-errors'

export function normalizeResetPasswordSearch(search: Record<string, unknown>) {
  return {
    token: typeof search.token === 'string' ? search.token : '',
  }
}

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: normalizeResetPasswordSearch,
})

type StatusVariant = 'success' | 'error' | 'warning'

type ResetStatusPresentation = {
  title: string
  message: string
  variant: StatusVariant
}

const RESET_STATUS_PRESENTATIONS = {
  password_reset: {
    title: 'Password reset',
    message:
      'Your password has been reset successfully. You can now sign in with your new password.',
    variant: 'success',
  },
  invalid_token: {
    title: 'Invalid reset link',
    message:
      'This password reset link is invalid or has expired. Please request a new one.',
    variant: 'error',
  },
  expired: {
    title: 'Link expired',
    message: 'This password reset link has expired. Please request a new one.',
    variant: 'warning',
  },
  already_used: {
    title: 'Link already used',
    message:
      'This password reset link has already been used. Please request a new one if you need to reset your password again.',
    variant: 'warning',
  },
} as const satisfies Record<
  Exclude<
    Awaited<ReturnType<typeof usePasswordResetForm>>['result']['status'],
    'idle'
  >,
  ResetStatusPresentation
>

const INVALID_LINK_PRESENTATION: ResetStatusPresentation = {
  title: 'Invalid reset link',
  message: 'This password reset link is invalid. Please request a new one.',
  variant: 'error',
}

export function resolveResetPresentation(
  status: string,
): ResetStatusPresentation {
  if (status in RESET_STATUS_PRESENTATIONS) {
    return RESET_STATUS_PRESENTATIONS[
      status as keyof typeof RESET_STATUS_PRESENTATIONS
    ]
  }
  return INVALID_LINK_PRESENTATION
}

export function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const resetPasswordAction = useAction(api.passwordReset.resetPassword)

  const {
    newPassword,
    confirmPassword,
    setNewPassword,
    setConfirmPassword,
    isSubmitting,
    error,
    result,
    submit,
  } = usePasswordResetForm({
    resetPassword: (params) => resetPasswordAction(params),
    mapErrorMessage: (err) =>
      toGlotcapConvexErrorMessage(err, 'account.password.reset.submit'),
    token,
  })

  if (!token) {
    return (
      <AuthPageShell>
        <StatusCard presentation={INVALID_LINK_PRESENTATION} />
      </AuthPageShell>
    )
  }

  if (result.status !== 'idle') {
    return (
      <AuthPageShell>
        <StatusCard presentation={resolveResetPresentation(result.status)} />
      </AuthPageShell>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submit()
  }

  return (
    <AuthPageShell>
      <Card className={cn('border', APP_PANEL_CLASS)}>
        <CardHeader className="items-center text-center">
          <div
            className={cn(
              'mb-2 flex h-10 w-10 items-center justify-center rounded-full',
              APP_BRAND_SURFACE_CLASS,
            )}
          >
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>

          <div className="text-center">
            <Link
              to="/"
              search={{ auth: 'login' }}
              className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}

function StatusCard({
  presentation,
}: {
  presentation: ResetStatusPresentation
}) {
  const icon =
    presentation.variant === 'success' ? (
      <CheckCircle className="size-5 text-emerald-300" />
    ) : presentation.variant === 'warning' ? (
      <XCircle className="size-5 text-amber-300" />
    ) : (
      <XCircle className="size-5 text-red-300" />
    )

  return (
    <Card className={cn('border', APP_PANEL_CLASS)}>
      <CardHeader className="items-center text-center">
        <div
          className={cn(
            'mb-2 flex h-10 w-10 items-center justify-center rounded-full',
            APP_BRAND_SURFACE_CLASS,
          )}
        >
          {icon}
        </div>
        <CardTitle className="text-xl">{presentation.title}</CardTitle>
        <CardDescription>{presentation.message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap justify-center gap-2">
        <Link to="/" search={{ auth: 'login' }}>
          <Button variant="outline">Back to login</Button>
        </Link>
        <Link to="/forgot-password">
          <Button variant="ghost">Request a new link</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
