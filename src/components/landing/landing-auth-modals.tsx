import type { LandingAuthFlow } from '@/components/landing/use-landing-auth-flow'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { WaitlistDialog } from '@/components/waitlist-dialog'

type LandingAuthModalsProps = {
  flow: LandingAuthFlow
}

export function LandingAuthModals({ flow }: LandingAuthModalsProps) {
  return (
    <>
      <WaitlistDialog
        open={flow.isWaitlistOpen}
        onOpenChange={flow.handleWaitlistOpenChange}
        source="landing-cinematic"
        onHaveCode={flow.openSignupWithoutInvite}
      />
      {flow.authView ? (
        <AuthDialog
          open
          view={flow.authView}
          onOpenChange={flow.handleAuthOpenChange}
          onSwitchView={flow.handleAuthSwitchView}
          onOpenWaitlist={flow.openWaitlist}
          defaultInviteCode={flow.inviteParam}
        />
      ) : null}
    </>
  )
}
