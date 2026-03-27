import { useCallback, useEffect, useState } from 'react'
import type { AuthDialogView } from '@/components/auth/auth-dialog'

export type LandingModalView = 'waitlist' | AuthDialogView | null

type LandingAuthFlowState = {
  activeModal: LandingModalView
  inviteParam: string | null
  isWaitlistOpen: boolean
  authView: AuthDialogView | null
}

type LandingAuthFlowActions = {
  openWaitlist: () => void
  openLogin: () => void
  openSignup: (invite?: string | null) => void
  handleWaitlistOpenChange: (open: boolean) => void
  handleAuthOpenChange: (open: boolean) => void
  handleAuthSwitchView: (view: AuthDialogView) => void
  openSignupWithoutInvite: () => void
}

export type LandingAuthFlow = LandingAuthFlowState & LandingAuthFlowActions

export function useLandingAuthFlow(): LandingAuthFlow {
  const [activeModal, setActiveModal] = useState<LandingModalView>(null)
  const [inviteParam, setInviteParam] = useState<string | null>(null)

  const openWaitlist = useCallback(() => {
    setInviteParam(null)
    setActiveModal('waitlist')
  }, [])

  const openLogin = useCallback(() => {
    setInviteParam(null)
    setActiveModal('login')
  }, [])

  const openSignup = useCallback((invite?: string | null) => {
    setInviteParam(invite ?? null)
    setActiveModal('signup')
  }, [])

  const handleWaitlistOpenChange = useCallback((open: boolean) => {
    setActiveModal(open ? 'waitlist' : null)
    if (!open) {
      setInviteParam(null)
    }
  }, [])

  const handleAuthOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActiveModal(null)
      setInviteParam(null)
    }
  }, [])

  const handleAuthSwitchView = useCallback((view: AuthDialogView) => {
    setInviteParam(null)
    setActiveModal(view)
  }, [])

  const openSignupWithoutInvite = useCallback(() => {
    openSignup(null)
  }, [openSignup])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    const auth = params.get('auth')

    if (invite) {
      openSignup(invite)
      return
    }

    if (auth === 'confirmed') {
      setActiveModal('confirmed')
      return
    }

    if (auth === 'login') {
      setActiveModal('login')
      return
    }

    if (auth === 'signup') {
      setActiveModal('signup')
      return
    }

    if (auth === 'waitlist') {
      setActiveModal('waitlist')
    }
  }, [openSignup])

  const isWaitlistOpen = activeModal === 'waitlist'
  const authView =
    activeModal && activeModal !== 'waitlist' ? activeModal : null

  return {
    activeModal,
    inviteParam,
    isWaitlistOpen,
    authView,
    openWaitlist,
    openLogin,
    openSignup,
    handleWaitlistOpenChange,
    handleAuthOpenChange,
    handleAuthSwitchView,
    openSignupWithoutInvite,
  }
}
