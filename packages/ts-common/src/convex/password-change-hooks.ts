import { useState } from 'react'

type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type UsePasswordChangeOptions = {
  changePassword: (input: ChangePasswordInput) => Promise<unknown>
  mapErrorMessage: (error: unknown) => string
}

type SubmitResult = {
  status: 'submitted' | 'blocked'
}

export function usePasswordChange({
  changePassword,
  mapErrorMessage,
}: UsePasswordChangeOptions) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit(): Promise<SubmitResult> {
    setError(null)
    setSuccess(null)

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return { status: 'blocked' }
    }

    setIsSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })
      setSuccess(
        'Password updated successfully. Other sessions have been signed out.',
      )
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      return { status: 'submitted' }
    } catch (err) {
      setError(mapErrorMessage(err))
      return { status: 'submitted' }
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
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
  }
}
