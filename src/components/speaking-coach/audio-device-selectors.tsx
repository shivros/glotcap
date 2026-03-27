import type { AudioInputOption } from '@/lib/audio/audio-device-port'
import type {
  SpeakingConversationMode,
  TeacherInputSourceMethod,
} from '@/lib/speaking-session-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AudioDeviceSelectorsProps = {
  conversationMode: SpeakingConversationMode
  audioInputDevices: Array<AudioInputOption>
  learnerDeviceId: string | null
  teacherDeviceId: string | null
  teacherInputSourceMethod: TeacherInputSourceMethod
  canCaptureDisplayAudio: boolean
  onLearnerDeviceChange: (value: string | null) => void
  onTeacherDeviceChange: (value: string | null) => void
  onTeacherInputSourceMethodChange: (value: TeacherInputSourceMethod) => void
  disabled: boolean
}

export const AudioDeviceSelectors = ({
  conversationMode,
  audioInputDevices,
  learnerDeviceId,
  teacherDeviceId,
  teacherInputSourceMethod,
  canCaptureDisplayAudio,
  onLearnerDeviceChange,
  onTeacherDeviceChange,
  onTeacherInputSourceMethodChange,
  disabled,
}: AudioDeviceSelectorsProps) => {
  const hasAudioInputs = audioInputDevices.length > 0
  const isDualStream = conversationMode === 'dual_stream'
  const shouldShowTeacherDeviceSelector =
    isDualStream && teacherInputSourceMethod === 'device'
  const audioInputItems = audioInputDevices.map((device) => ({
    value: device.id,
    label: device.label,
  }))

  const containerClassName =
    isDualStream && teacherInputSourceMethod === 'device'
      ? 'grid gap-3 xl:grid-cols-3'
      : isDualStream
        ? 'grid gap-3 xl:grid-cols-2'
        : 'grid gap-3'

  return (
    <div className={containerClassName}>
      <div className="grid gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Learner microphone
        </p>
        <Select
          value={learnerDeviceId}
          onValueChange={(value) => onLearnerDeviceChange(value)}
          items={audioInputItems}
          disabled={disabled || !hasAudioInputs}
        >
          <SelectTrigger className="w-full max-w-[260px] min-w-0 border-input bg-card/75 px-3 py-2">
            <SelectValue
              placeholder={
                hasAudioInputs ? 'Select microphone' : 'No audio inputs found'
              }
            />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {audioInputDevices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {conversationMode === 'dual_stream' ? (
        <div className="grid gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Teacher capture method
          </p>
          <Select
            value={teacherInputSourceMethod}
            onValueChange={(value) => {
              if (value === 'display' || value === 'device') {
                onTeacherInputSourceMethodChange(value)
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full max-w-[260px] min-w-0 border-input bg-card/75 px-3 py-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="device">Audio input device</SelectItem>
              <SelectItem value="display" disabled={!canCaptureDisplayAudio}>
                Screen share audio
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {shouldShowTeacherDeviceSelector ? (
        <div className="grid gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Teacher audio source
          </p>
          <Select
            value={teacherDeviceId}
            onValueChange={(value) => onTeacherDeviceChange(value)}
            items={audioInputItems}
            disabled={disabled || !hasAudioInputs}
          >
            <SelectTrigger className="w-full max-w-[260px] min-w-0 border-input bg-card/75 px-3 py-2">
              <SelectValue
                placeholder={
                  hasAudioInputs
                    ? 'Select audio source'
                    : 'No audio inputs found'
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {audioInputDevices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}
