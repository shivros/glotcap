import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { Mail } from 'lucide-react'
import { usePasswordResetRequest } from 'ts-common/convex/password-reset-hooks'

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

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

export function ForgotPasswordPage() {
  const requestPasswordReset = useAction(api.passwordReset.requestPasswordReset)

  const { email, setEmail, isSubmitting, error, success, submit } =
    usePasswordResetRequest({
      requestReset: (emailInput) => requestPasswordReset({ email: emailInput }),
      mapErrorMessage: (err) =>
        toGlotcapConvexErrorMessage(err, 'account.password.reset.request'),
    })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submit()
  }

  if (success) {
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
              <Mail className="size-5" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              If an account exists for <strong>{email}</strong>, we sent a
              password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-xs text-white/50">
              The link expires in 1 hour. Check your spam folder if you
              don&apos;t see it.
            </p>
            <div className="flex justify-center">
              <Link to="/" search={{ auth: 'login' }}>
                <Button variant="outline">Back to login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <Card className={cn('border', APP_PANEL_CLASS)}>
        <CardHeader>
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send reset link'}
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
