import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useMutation } from 'convex/react'
import {
  isWaitlistEmailValid,
  normalizeWaitlistEmail,
} from 'ts-common/waitlist'
import { api } from '../../convex/_generated/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AppModalContent } from '@/components/ui/app-modal-content'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type WaitlistDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  source?: string
  onHaveCode?: () => void
}

type WaitlistStatus = 'idle' | 'submitting' | 'success' | 'error'

export function WaitlistDialog({
  open,
  onOpenChange,
  source = 'glotcap-demo',
  onHaveCode,
}: WaitlistDialogProps) {
  const joinWaitlist = useMutation(api.waitlist.joinWaitlist)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<WaitlistStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const isSubmitting = status === 'submitting'

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (status === 'success') {
      setEmail('')
    }
  }, [open, reset, status])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const normalized = normalizeWaitlistEmail(email)

      if (!isWaitlistEmailValid(normalized)) {
        setError('Enter a valid email address.')
        setStatus('error')
        return
      }

      setError(null)
      setStatus('submitting')

      try {
        await joinWaitlist({
          email: normalized,
          source,
        })
        setStatus('success')
      } catch (err) {
        console.error('Waitlist signup failed', err)
        setError('We could not save your email. Please try again.')
        setStatus('error')
      }
    },
    [email, joinWaitlist, source],
  )

  const description = useMemo(() => {
    if (status === 'success') {
      return 'You are on the list. We will email you as soon as GlotCap is ready.'
    }
    return 'Leave your email and we will let you know when GlotCap opens.'
  }, [status])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AppModalContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/20 text-primary">
            <Sparkles className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Join the wait list</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {status === 'success' ? null : (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="waitlist-email">Email address</Label>
              <Input
                id="waitlist-email"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              <button
                type="button"
                className="text-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  onOpenChange(false)
                  onHaveCode?.()
                }}
              >
                Click here if you have a sign up code.
              </button>
            </p>
            <AlertDialogFooter className="mt-1 bg-transparent">
              <AlertDialogCancel
                disabled={isSubmitting}
                className="border-input"
              >
                Not now
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-white hover:bg-primary/80 hover:text-primary-foreground"
              >
                {isSubmitting ? 'Joining...' : 'Join the wait list'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
        {status === 'success' ? (
          <AlertDialogFooter className="bg-transparent">
            <AlertDialogCancel className="border-input">
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        ) : null}
      </AppModalContent>
    </AlertDialog>
  )
}
