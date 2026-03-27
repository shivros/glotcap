import { createFileRoute } from '@tanstack/react-router'
import { MediaToolPage } from '@/components/tools/media-tool-page'

export const Route = createFileRoute('/tools/transcribe')({
  component: ToolsTranscribeRoute,
})

function ToolsTranscribeRoute() {
  return (
    <MediaToolPage
      mode="transcript"
      title="Audio to Transcript"
      description="Upload audio and receive a plain-text transcript."
    />
  )
}
