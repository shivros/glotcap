import { Mic } from 'lucide-react'
import type { AudioPermissionState } from '@/lib/audio/audio-device-port'
import { Button } from '@/components/ui/button'

type AudioPermissionBannerProps = {
  isSupported: boolean
  permissionState: AudioPermissionState
  errorMessage: string | null
  isBusy: boolean
  isActive: boolean
  onRequestPermission: () => void
}

export const AudioPermissionBanner = ({
  isSupported,
  permissionState,
  errorMessage,
  isBusy,
  isActive,
  onRequestPermission,
}: AudioPermissionBannerProps) => (
  <>
    {isSupported &&
    permissionState !== 'granted' &&
    permissionState !== 'unsupported' ? (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/8 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRequestPermission}
          disabled={isBusy || isActive || permissionState === 'requesting'}
        >
          <Mic className="size-3.5" />
          {permissionState === 'requesting'
            ? 'Requesting access...'
            : 'Allow microphone access'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {permissionState === 'denied'
            ? 'Microphone access is blocked. Re-enable it in browser site settings, then refresh.'
            : 'If you only see generic entries like "Audio input 1", grant microphone access to reveal full device names.'}
        </p>
      </div>
    ) : null}
    {errorMessage ? (
      <p className="text-xs text-destructive">{errorMessage}</p>
    ) : null}
  </>
)
