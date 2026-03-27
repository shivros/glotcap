import { useState } from 'react'

type UsePasswordResetRequestOptions = {
  requestReset: (email: string) => Promise<unknown>
  mapErrorMessage: (error: unknown) => string
}

export function usePasswordResetRequest({
  requestReset,
  mapErrorMessage,
}: UsePasswordResetRequestOptions) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (!email.trim()) return
    setError(null)
    setIsSubmitting(true)
    try {
      await requestReset(email)
      setSuccess(true)
    } catch (err) {
      setError(mapErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    email,
    setEmail,
    isSubmitting,
    error,
    success,
    submit,
  }
}

type UsePasswordResetFormOptions = {
  resetPassword: (params: {
    token: string
    newPassword: string
    confirmPassword: string
  }) => Promise<
    | { status: 'password_reset' }
    | { status: 'invalid_token' }
    | { status: 'expired'; email: string }
    | { status: 'already_used'; email: string }
  >
  mapErrorMessage: (error: unknown) => string
  token: string
  mismatchMessage?: string
}

export type ResetFormResult =
  | { status: 'idle' }
  | { status: 'password_reset' }
  | { status: 'invalid_token' }
  | { status: 'expired' }
  | { status: 'already_used' }

const DEFAULT_MISMATCH_MESSAGE = 'New password and confirmation do not match.'

export function usePasswordResetForm({
  resetPassword,
  mapErrorMessage,
  token,
  mismatchMessage = DEFAULT_MISMATCH_MESSAGE,
}: UsePasswordResetFormOptions) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResetFormResult>({ status: 'idle' })

  async function submit() {
    setError(null)

    if (newPassword !== confirmPassword) {
      setError(mismatchMessage)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await resetPassword({
        token,
        newPassword,
        confirmPassword,
      })

      if (response.status === 'password_reset') {
        setResult({ status: 'password_reset' })
      } else if (response.status === 'expired') {
        setResult({ status: 'expired' })
      } else if (response.status === 'already_used') {
        setResult({ status: 'already_used' })
      } else {
        setResult({ status: 'invalid_token' })
      }
    } catch (err) {
      setError(mapErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    newPassword,
    confirmPassword,
    setNewPassword,
    setConfirmPassword,
    isSubmitting,
    error,
    result,
    submit,
  }
}
