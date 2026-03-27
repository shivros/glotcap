import { useEffect, useState } from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react'
import { usePasswordChange } from 'ts-common/convex/password-change-hooks'
import { api } from '../../convex/_generated/api'
import type { EmailChangeStatusView } from 'ts-common/convex/email-change'
import type { SecurityCapabilities } from 'ts-common/convex/security-capabilities'

import { toGlotcapConvexErrorMessage } from '@/lib/convex-errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageSpinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/account')({
  validateSearch: (search: Record<string, unknown>) => ({
    emailChange: search.emailChange === 'verified' ? 'verified' : undefined,
  }),
  component: AccountRouteShell,
})

type PendingEmailChange = NonNullable<EmailChangeStatusView['pendingChange']>

function useEmailChangeFlashMessage() {
  const navigate = useNavigate()
  const { emailChange } = Route.useSearch()
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (emailChange !== 'verified') {
      return
    }
    setVerificationSuccess('Your email has been updated successfully.')
    navigate({
      to: '/account',
      search: { emailChange: undefined },
      replace: true,
    })
  }, [emailChange, navigate])

  return verificationSuccess
}

function AccountRouteShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const verificationSuccess = useEmailChangeFlashMessage()
  const isEmailVerifyRoute =
    location.pathname === '/account/email-change/verify'

  useEffect(() => {
    if (!isEmailVerifyRoute && !isLoading && !isAuthenticated) {
      navigate({ to: '/' })
    }
  }, [isEmailVerifyRoute, isLoading, isAuthenticated, navigate])

  if (isEmailVerifyRoute) {
    return <Outlet />
  }

  if (isLoading || !isAuthenticated) {
    return <PageSpinner />
  }

  return <AccountPage flashMessage={verificationSuccess} />
}

function AccountPage({
  flashMessage = null,
}: {
  flashMessage?: string | null
}) {
  const emailChangeStatus = useQuery(api.emailChange.getEmailChangeStatus, {})
  const securityCapabilities = useQuery(
    api.accountSecurity.getSecurityCapabilities,
    {},
  ) as SecurityCapabilities | undefined

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-medium text-white/70">
            Manage account
          </h1>
        </div>
        <Link to="/app">
          <Button variant="outline" size="sm">
            Back to app
          </Button>
        </Link>
      </div>

      {flashMessage ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-medium text-emerald-300">{flashMessage}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailChangeSection
              currentEmail={emailChangeStatus?.currentEmail ?? null}
              pendingChange={emailChangeStatus?.pendingChange ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeSection
              canChangePassword={securityCapabilities?.canChangePassword}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function EmailChangeSection({
  currentEmail,
  pendingChange,
}: {
  currentEmail: string | null
  pendingChange: PendingEmailChange | null
}) {
  return (
    <EmailChangeSectionContainer
      currentEmail={currentEmail}
      pendingChange={pendingChange}
    />
  )
}

function EmailChangeSectionContainer({
  currentEmail,
  pendingChange,
}: {
  currentEmail: string | null
  pendingChange: PendingEmailChange | null
}) {
  const requestEmailChange = useAction(api.emailChange.requestEmailChange)
  const resendVerification = useAction(
    api.emailChange.resendEmailChangeVerification,
  )
  const cancelEmailChange = useMutation(api.emailChange.cancelEmailChange)
  const [newEmail, setNewEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleRequestEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const result = await requestEmailChange({ newEmail })
      setSuccess(`Verification email sent to ${result.newEmail}.`)
      setNewEmail('')
    } catch (err) {
      setError(toGlotcapConvexErrorMessage(err, 'account.emailChange.request'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendVerification() {
    setError(null)
    setSuccess(null)
    setIsResending(true)
    try {
      const result = await resendVerification({})
      setSuccess(`Verification email resent to ${result.newEmail}.`)
    } catch (err) {
      setError(toGlotcapConvexErrorMessage(err, 'account.emailChange.resend'))
    } finally {
      setIsResending(false)
    }
  }

  async function handleCancelPendingChange() {
    setError(null)
    setSuccess(null)
    setIsCancelling(true)
    try {
      await cancelEmailChange({})
      setSuccess('Pending email change cancelled.')
    } catch (err) {
      setError(toGlotcapConvexErrorMessage(err, 'account.emailChange.cancel'))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <EmailChangeSectionView
      currentEmail={currentEmail}
      pendingChange={pendingChange}
      newEmail={newEmail}
      isSubmitting={isSubmitting}
      isResending={isResending}
      isCancelling={isCancelling}
      error={error}
      success={success}
      onChangeNewEmail={setNewEmail}
      onSubmitNewEmail={handleRequestEmailChange}
      onResendVerification={handleResendVerification}
      onCancelPendingChange={handleCancelPendingChange}
    />
  )
}

function EmailChangeSectionView({
  currentEmail,
  pendingChange,
  newEmail,
  isSubmitting,
  isResending,
  isCancelling,
  error,
  success,
  onChangeNewEmail,
  onSubmitNewEmail,
  onResendVerification,
  onCancelPendingChange,
}: {
  currentEmail: string | null
  pendingChange: PendingEmailChange | null
  newEmail: string
  isSubmitting: boolean
  isResending: boolean
  isCancelling: boolean
  error: string | null
  success: string | null
  onChangeNewEmail: (value: string) => void
  onSubmitNewEmail: (e: React.FormEvent) => void
  onResendVerification: () => void
  onCancelPendingChange: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current-email">Current email</Label>
        <Input
          id="current-email"
          value={currentEmail ?? ''}
          disabled
          readOnly
        />
      </div>

      <form className="space-y-3" onSubmit={onSubmitNewEmail}>
        <div className="space-y-1.5">
          <Label htmlFor="new-email">New email</Label>
          <Input
            id="new-email"
            type="email"
            placeholder="you@new-email.com"
            value={newEmail}
            onChange={(e) => onChangeNewEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send verification email'}
        </Button>
      </form>

      {pendingChange ? (
        <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <p className="text-sm font-medium text-sky-300">
            Pending change: {pendingChange.newEmail}
          </p>
          <p className="text-xs leading-relaxed text-white/50">
            {pendingChange.isExpired
              ? 'This verification link has expired. Request a new email change.'
              : `Verification expires on ${new Date(
                  pendingChange.expiresAt,
                ).toLocaleString()}.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onResendVerification}
              disabled={isResending || pendingChange.isExpired}
            >
              {isResending ? 'Resending...' : 'Resend verification'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelPendingChange}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </div>
  )
}

export function PasswordChangeSection({
  canChangePassword,
}: {
  canChangePassword: boolean | undefined
}) {
  if (canChangePassword === undefined) {
    return <p className="text-sm text-white/50">Loading security settings...</p>
  }

  if (!canChangePassword) {
    return (
      <p className="text-sm text-white/50">
        Password change is available only for email/password accounts.
      </p>
    )
  }

  return <PasswordChangeSectionContainer />
}

function PasswordChangeSectionContainer() {
  const changePasswordAction = useAction(api.accountSecurity.changePassword)
  const {
    currentPassword,
    newPassword,
    confirmPassword,
    isSubmitting,
    error,
    success,
    setCurrentPassword,
    setNewPassword,
    setConfirmPassword,
    submit,
  } = usePasswordChange({
    changePassword: changePasswordAction,
    mapErrorMessage: (cause) =>
      toGlotcapConvexErrorMessage(cause, 'account.password.change'),
  })

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    await submit()
  }

  return (
    <PasswordChangeSectionView
      currentPassword={currentPassword}
      newPassword={newPassword}
      confirmPassword={confirmPassword}
      isSubmitting={isSubmitting}
      error={error}
      success={success}
      onChangeCurrentPassword={setCurrentPassword}
      onChangeNewPassword={setNewPassword}
      onChangeConfirmPassword={setConfirmPassword}
      onSubmit={handleChangePassword}
    />
  )
}

function PasswordChangeSectionView({
  currentPassword,
  newPassword,
  confirmPassword,
  isSubmitting,
  error,
  success,
  onChangeCurrentPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onSubmit,
}: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  isSubmitting: boolean
  error: string | null
  success: string | null
  onChangeCurrentPassword: (value: string) => void
  onChangeNewPassword: (value: string) => void
  onChangeConfirmPassword: (value: string) => void
  onSubmit: (event: React.FormEvent) => Promise<void>
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => onChangeCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => onChangeNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => onChangeConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Updating...' : 'Update password'}
      </Button>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </form>
  )
}
