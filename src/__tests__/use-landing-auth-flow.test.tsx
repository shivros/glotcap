import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLandingAuthFlow } from '@/components/landing/use-landing-auth-flow'

const setSearch = (search: string) => {
  const suffix = search ? `/?${search}` : '/'
  window.history.replaceState({}, '', suffix)
}

describe('useLandingAuthFlow', () => {
  beforeEach(() => {
    setSearch('')
  })

  it('defaults to closed modals with no invite code', () => {
    const { result } = renderHook(() => useLandingAuthFlow())

    expect(result.current.activeModal).toBeNull()
    expect(result.current.authView).toBeNull()
    expect(result.current.isWaitlistOpen).toBe(false)
    expect(result.current.inviteParam).toBeNull()
  })

  it('opens signup with invite from query params', async () => {
    setSearch('invite=ABCD1234')
    const { result } = renderHook(() => useLandingAuthFlow())

    await waitFor(() => expect(result.current.activeModal).toBe('signup'))
    expect(result.current.authView).toBe('signup')
    expect(result.current.inviteParam).toBe('ABCD1234')
    expect(result.current.isWaitlistOpen).toBe(false)
  })

  it.each([['login'], ['signup'], ['confirmed'], ['waitlist']] as const)(
    'opens %s from auth query param',
    async (authValue) => {
      setSearch(`auth=${authValue}`)
      const { result } = renderHook(() => useLandingAuthFlow())

      await waitFor(() => expect(result.current.activeModal).toBe(authValue))
      if (authValue === 'waitlist') {
        expect(result.current.isWaitlistOpen).toBe(true)
        expect(result.current.authView).toBeNull()
      } else {
        expect(result.current.authView).toBe(authValue)
        expect(result.current.isWaitlistOpen).toBe(false)
      }
    },
  )

  it('resets invite code when opening waitlist and when closing waitlist', () => {
    const { result } = renderHook(() => useLandingAuthFlow())

    act(() => {
      result.current.openSignup('WXYZ9999')
    })
    expect(result.current.activeModal).toBe('signup')
    expect(result.current.inviteParam).toBe('WXYZ9999')

    act(() => {
      result.current.openWaitlist()
    })
    expect(result.current.activeModal).toBe('waitlist')
    expect(result.current.inviteParam).toBeNull()

    act(() => {
      result.current.handleWaitlistOpenChange(false)
    })
    expect(result.current.activeModal).toBeNull()
    expect(result.current.inviteParam).toBeNull()
  })

  it('resets invite code when auth dialog closes and supports signup without invite', () => {
    const { result } = renderHook(() => useLandingAuthFlow())

    act(() => {
      result.current.openSignup('INVITE42')
    })
    expect(result.current.activeModal).toBe('signup')
    expect(result.current.inviteParam).toBe('INVITE42')

    act(() => {
      result.current.handleAuthOpenChange(false)
    })
    expect(result.current.activeModal).toBeNull()
    expect(result.current.inviteParam).toBeNull()

    act(() => {
      result.current.openSignupWithoutInvite()
    })
    expect(result.current.activeModal).toBe('signup')
    expect(result.current.inviteParam).toBeNull()
  })
})
