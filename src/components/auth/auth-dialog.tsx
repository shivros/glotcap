import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LogIn, Mail, Sparkles } from 'lucide-react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Link } from '@tanstack/react-router'
import { isInviteCodeFormatValid, normalizeInviteCode } from 'ts-common/invites'
import { useSafeConvexAuthActions as useAuthActions } from 'ts-common/auth/providers/convex/client'

import { api } from '../../../convex/_generated/api'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AppModalContent } from '@/components/ui/app-modal-content'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/error-banner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toAppError } from '@/lib/errors'
import { logAppError } from '@/lib/logging'

export type AuthDialogView = 'login' | 'signup' | 'confirmed'

type AuthDialogProps = {
  open: boolean
  view: AuthDialogView
  onOpenChange: (open: boolean) => void
  onSwitchView: (view: AuthDialogView) => void
  onOpenWaitlist: () => void
  defaultInviteCode?: string | null
}

const AUTH_CONFIRM_REDIRECT = '/?auth=confirmed'

export function AuthDialog({
  open,
  view,
  onOpenChange,
  onSwitchView,
  onOpenWaitlist,
  defaultInviteCode,
}: AuthDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AppModalContent>
        {view === 'login' ? (
          <LoginPanel
            open={open}
            onClose={() => onOpenChange(false)}
            onOpenWaitlist={onOpenWaitlist}
            onSwitchView={onSwitchView}
          />
        ) : null}
        {view === 'signup' ? (
          <SignupPanel
            open={open}
            defaultInviteCode={defaultInviteCode}
            onClose={() => onOpenChange(false)}
            onOpenWaitlist={onOpenWaitlist}
            onSwitchView={onSwitchView}
          />
        ) : null}
        {view === 'confirmed' ? (
          <ConfirmedPanel
            onClose={() => onOpenChange(false)}
            onSwitchView={onSwitchView}
            onOpenWaitlist={onOpenWaitlist}
          />
        ) : null}
      </AppModalContent>
    </AlertDialog>
  )
}

type PanelProps = {
  open: boolean
  onClose: () => void
  onSwitchView: (view: AuthDialogView) => void
  onOpenWaitlist: () => void
}

function LoginPanel({
  open,
  onClose,
  onSwitchView,
  onOpenWaitlist,
}: PanelProps) {
  const { signIn } = useAuthActions()
  const logEventMutation = useMutation(api.logging.logEvent)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setPassword('')
      setIsLoading(false)
      setError(null)
      setEmailSent(false)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('password', {
        email,
        password,
        flow: 'signIn',
        redirectTo: AUTH_CONFIRM_REDIRECT,
      })
      if (result.signingIn) {
        onClose()
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      const appError = toAppError(err, {
        message: 'Sign in failed',
        source: 'convex',
      })
      await logAppError(logEventMutation, appError, {
        feature: 'auth',
        action: 'login',
      })
      setError(appError.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOAuthSignIn(provider: 'github' | 'google') {
    setIsLoading(true)
    setError(null)
    try {
      await signIn(provider)
    } catch (err) {
      const appError = toAppError(err, {
        message: 'OAuth sign in failed',
        source: 'convex',
      })
      await logAppError(logEventMutation, appError, {
        feature: 'auth',
        action: `oauth-${provider}`,
      })
      setError(appError.message)
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/20 text-primary">
            <Mail className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Check your email</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Confirm
            your email to finish signing in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-center text-sm text-muted-foreground">
          Need a new account?{' '}
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={onOpenWaitlist}
          >
            Join the wait list
          </button>
        </div>
        <AlertDialogFooter className="bg-transparent">
          <AlertDialogCancel className="border-input">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-primary/20 text-primary">
          <LogIn className="size-5" />
        </AlertDialogMedia>
        <AlertDialogTitle>Welcome back</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          Sign in to your account to continue.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-4">
        {error ? (
          <ErrorBanner message={error} onAction={() => setError(null)} />
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            <div className="text-right">
              <Link
                to="/forgot-password"
                onClick={() => onClose()}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-white hover:bg-primary/80 hover:text-primary-foreground"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card/90 px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            className="border-input bg-card/90 text-foreground"
            onClick={() => handleOAuthSignIn('github')}
          >
            <GitHubIcon className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            className="border-input bg-card/90 text-foreground"
            onClick={() => handleOAuthSignIn('google')}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            Google
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Need a signup code?{' '}
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={onOpenWaitlist}
          >
            Join the wait list
          </button>
          <span className="mx-2 text-muted-foreground">·</span>
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={() => onSwitchView('signup')}
          >
            Have a code?
          </button>
        </div>
      </div>
      <AlertDialogFooter className="bg-transparent">
        <AlertDialogCancel className="border-input">Close</AlertDialogCancel>
      </AlertDialogFooter>
    </>
  )
}

type SignupPanelProps = PanelProps & {
  defaultInviteCode?: string | null
}

function SignupPanel({
  open,
  onClose,
  defaultInviteCode,
  onOpenWaitlist,
  onSwitchView,
}: SignupPanelProps) {
  const { signIn } = useAuthActions()
  const logEventMutation = useMutation(api.logging.logEvent)
  const consumeInvite = useMutation(api.invites.consumeInvite)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState(() =>
    normalizeInviteCode(defaultInviteCode ?? ''),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const isInviteFormatValid = isInviteCodeFormatValid(inviteCode)
  const inviteStatus = useQuery(
    api.invites.validateInvite,
    isInviteFormatValid ? { code: inviteCode } : 'skip',
  )
  const isInviteValid = inviteStatus?.valid === true
  const inviteMessage =
    inviteStatus && !inviteStatus.valid ? inviteStatus.message : null
  const isInviteChecking = isInviteFormatValid && inviteStatus === undefined

  useEffect(() => {
    if (!open) {
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setDisplayName('')
      setInviteCode(normalizeInviteCode(defaultInviteCode ?? ''))
      setIsLoading(false)
      setError(null)
      setValidationError(null)
      setInviteError(null)
      setEmailSent(false)
    }
  }, [defaultInviteCode, open])

  useEffect(() => {
    if (defaultInviteCode) {
      setInviteCode(normalizeInviteCode(defaultInviteCode))
    }
  }, [defaultInviteCode])

  useEffect(() => {
    setInviteError(null)
  }, [inviteCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)
    setError(null)
    setInviteError(null)

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      if (!isInviteValid) {
        setInviteError(
          inviteMessage ?? 'Enter a valid sign up code to continue.',
        )
        return
      }

      try {
        await consumeInvite({ code: inviteCode })
      } catch (err) {
        const appError = toAppError(err, {
          message: 'Unable to use that sign up code.',
          source: 'convex',
        })
        setInviteError(appError.message)
        return
      }

      const result = await signIn('password', {
        email,
        password,
        ...(displayName ? { name: displayName } : {}),
        flow: 'signUp',
        redirectTo: AUTH_CONFIRM_REDIRECT,
      })
      if (result.signingIn) {
        onClose()
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('verification')) {
        setEmailSent(true)
      } else {
        const appError = toAppError(err, {
          message: 'Sign up failed',
          source: 'convex',
        })
        await logAppError(logEventMutation, appError, {
          feature: 'auth',
          action: 'signup',
        })
        setError(appError.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOAuthSignIn(provider: 'github' | 'google') {
    setIsLoading(true)
    setError(null)
    setInviteError(null)
    try {
      if (!isInviteValid) {
        setInviteError(
          inviteMessage ?? 'Enter a valid sign up code to continue.',
        )
        return
      }

      try {
        await consumeInvite({ code: inviteCode })
      } catch (err) {
        const appError = toAppError(err, {
          message: 'Unable to use that sign up code.',
          source: 'convex',
        })
        setInviteError(appError.message)
        return
      }

      await signIn(provider)
    } catch (err) {
      const appError = toAppError(err, {
        message: 'OAuth sign in failed',
        source: 'convex',
      })
      await logAppError(logEventMutation, appError, {
        feature: 'auth',
        action: `oauth-${provider}`,
      })
      setError(appError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const inviteHelper = useMemo(() => {
    if (inviteError || inviteMessage) {
      return (
        <p className="text-xs text-destructive">
          {inviteError ?? inviteMessage}
        </p>
      )
    }
    if (isInviteChecking) {
      return <p className="text-xs text-muted-foreground">Checking code...</p>
    }
    if (!isInviteValid) {
      return (
        <p className="text-xs text-muted-foreground">
          Enter your 8-character sign up code to unlock registration.
        </p>
      )
    }
    return null
  }, [inviteError, inviteMessage, isInviteChecking, isInviteValid])

  if (emailSent) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/20 text-primary">
            <Mail className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Check your email</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click the
            link to complete your sign up.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-center text-sm text-muted-foreground">
          Need a new invite?{' '}
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={onOpenWaitlist}
          >
            Join the wait list
          </button>
        </div>
        <AlertDialogFooter className="bg-transparent">
          <AlertDialogCancel className="border-input">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-primary/20 text-primary">
          <Sparkles className="size-5" />
        </AlertDialogMedia>
        <AlertDialogTitle>
          {isInviteValid ? 'Create an account' : 'Enter your sign up code'}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          {isInviteValid
            ? 'Enter your details below to create your account.'
            : 'Use your invite to unlock GlotCap signup.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-invite-code">Sign up code</Label>
          <Input
            id="signup-invite-code"
            type="text"
            placeholder="ABCDEFGH"
            value={inviteCode}
            onChange={(e) => setInviteCode(normalizeInviteCode(e.target.value))}
            autoComplete="off"
            disabled={isLoading}
          />
          {inviteHelper}
        </div>

        {isInviteValid ? (
          <>
            {(error || validationError) && (
              <ErrorBanner
                message={validationError || error || 'Something went wrong.'}
                onAction={() => {
                  setError(null)
                  setValidationError(null)
                }}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Name (optional)</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">
                  Confirm Password
                </Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary/80 hover:text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card/90 px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                type="button"
                disabled={isLoading}
                className="border-input bg-card/90 text-foreground"
                onClick={() => handleOAuthSignIn('github')}
              >
                <GitHubIcon className="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={isLoading}
                className="border-input bg-card/90 text-foreground"
                onClick={() => handleOAuthSignIn('google')}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                Google
              </Button>
            </div>
          </>
        ) : null}

        <div className="text-center text-sm text-muted-foreground">
          Need a signup code?{' '}
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={onOpenWaitlist}
          >
            Join the wait list
          </button>
          <span className="mx-2 text-muted-foreground">·</span>
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline"
            onClick={() => onSwitchView('login')}
          >
            Already have an account?
          </button>
        </div>
      </div>
      <AlertDialogFooter className="bg-transparent">
        <AlertDialogCancel className="border-input">Close</AlertDialogCancel>
      </AlertDialogFooter>
    </>
  )
}

type ConfirmedPanelProps = {
  onClose: () => void
  onSwitchView: (view: AuthDialogView) => void
  onOpenWaitlist: () => void
}

function ConfirmedPanel({
  onClose,
  onSwitchView,
  onOpenWaitlist,
}: ConfirmedPanelProps) {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Verifying your email...</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Hang tight while we finish confirming your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      </>
    )
  }

  if (isAuthenticated) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/20 text-primary">
            <CheckCircle2 className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Email confirmed</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Your email has been verified. You can now access your GlotCap
            workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="bg-transparent">
          <AlertDialogCancel onClick={onClose} className="border-input">
            Continue
          </AlertDialogCancel>
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Please sign in</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">
          Your email is confirmed, but you need to sign in to continue.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="bg-primary text-white hover:bg-primary/80 hover:text-primary-foreground"
          onClick={() => onSwitchView('login')}
        >
          Sign in
        </Button>
        <Button
          variant="outline"
          type="button"
          className="border-input bg-card/90 text-foreground"
          onClick={onOpenWaitlist}
        >
          Join the wait list
        </Button>
      </div>
      <AlertDialogFooter className="bg-transparent">
        <AlertDialogCancel className="border-input">Close</AlertDialogCancel>
      </AlertDialogFooter>
    </>
  )
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
