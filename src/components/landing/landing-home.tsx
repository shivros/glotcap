import { LandingAuthModals } from '@/components/landing/landing-auth-modals'
import { LandingCinematic } from '@/components/landing/landing-cinematic'
import { useLandingAuthFlow } from '@/components/landing/use-landing-auth-flow'

export function LandingHome() {
  const flow = useLandingAuthFlow()

  return (
    <>
      <LandingCinematic
        onSignIn={flow.openLogin}
        onStartFree={flow.openWaitlist}
        demoHref="/demo"
      />
      <LandingAuthModals flow={flow} />
    </>
  )
}
