import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'

import { api } from '../../convex/_generated/api'
import { toGlotcapConvexErrorMessage } from '@/lib/convex-errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/account/email-change/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: VerifyEmailChangePage,
})

type VerifyResultStatus =
  | 'idle'
  | 'verifying'
  | 'verified'
  | 'invalid_token'
  | 'expired'
  | 'already_used'
  | 'email_taken'
  | 'error'

type VerifyResponseStatus =
  | 'verified'
  | 'already_used'
  | 'expired'
  | 'email_taken'
  | 'invalid_token'

type VerifyPresentation = {
  status: Exclude<VerifyResultStatus, 'idle' | 'verifying' | 'error'>
  message: string
  redirectOnSuccess: boolean
}

const VERIFIED_REDIRECT_DELAY_MS = 1000

const VERIFY_PRESENTATIONS: Record<VerifyResponseStatus, VerifyPresentation> = {
  verified: {
    status: 'verified',
    message: 'Your email has been updated successfully.',
    redirectOnSuccess: true,
  },
  already_used: {
    status: 'already_used',
    message: 'This verification link has already been used.',
    redirectOnSuccess: false,
  },
  expired: {
    status: 'expired',
    message: 'This verification link has expired.',
    redirectOnSuccess: false,
  },
  email_taken: {
    status: 'email_taken',
    message: 'That email is already in use by another account.',
    redirectOnSuccess: false,
  },
  invalid_token: {
    status: 'invalid_token',
    message: 'This verification link is invalid.',
    redirectOnSuccess: false,
  },
}

export function resolveVerifyPresentation(status: string): VerifyPresentation {
  if (status in VERIFY_PRESENTATIONS) {
    return VERIFY_PRESENTATIONS[status as VerifyResponseStatus]
  }
  return VERIFY_PRESENTATIONS.invalid_token
}

function scheduleVerifiedRedirect(params: {
  navigate: ReturnType<typeof useNavigate>
  isMounted: () => boolean
}) {
  return setTimeout(() => {
    if (!params.isMounted()) return
    params.navigate({
      to: '/account',
      search: { emailChange: 'verified' },
    })
  }, VERIFIED_REDIRECT_DELAY_MS)
}

export function VerifyEmailChangePage() {
  const { token } = Route.useSearch()
  return <VerifyEmailChangeView token={token} />
}

export function VerifyEmailChangeView({ token }: { token: string }) {
  const navigate = useNavigate()
  const verifyEmailChange = useAction(api.emailChange.verifyEmailChange)
  const [status, setStatus] = useState<VerifyResultStatus>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let mounted = true
    let verifiedRedirectTimer: ReturnType<typeof setTimeout> | undefined

    async function runVerification() {
      if (!token) {
        setStatus('invalid_token')
        setMessage('Missing verification token.')
        return
      }

      setStatus('verifying')
      setMessage('Confirming your new email...')

      try {
        const result = await verifyEmailChange({ token })
        if (!mounted) return

        const presentation = resolveVerifyPresentation(result.status)
        setStatus(presentation.status)
        setMessage(presentation.message)

        if (presentation.redirectOnSuccess) {
          verifiedRedirectTimer = scheduleVerifiedRedirect({
            navigate,
            isMounted: () => mounted,
          })
        }
      } catch (error) {
        if (!mounted) return
        setStatus('error')
        setMessage(
          toGlotcapConvexErrorMessage(error, 'account.emailChange.verify'),
        )
      }
    }

    runVerification()
    return () => {
      mounted = false
      if (verifiedRedirectTimer !== undefined) {
        clearTimeout(verifiedRedirectTimer)
      }
    }
  }, [navigate, token, verifyEmailChange])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Email change verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-white/50">{message}</p>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'verified' ? (
              <>
                <Link to="/account" search={{ emailChange: 'verified' }}>
                  <Button variant="outline" size="sm">
                    Back to account
                  </Button>
                </Link>
                <Link to="/app">
                  <Button size="sm">Go to app</Button>
                </Link>
              </>
            ) : (
              <Link to="/account" search={{ emailChange: undefined }}>
                <Button variant="outline" size="sm">
                  Back to account
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
