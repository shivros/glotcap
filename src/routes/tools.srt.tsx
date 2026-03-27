import { createFileRoute } from '@tanstack/react-router'
import { MediaToolPage } from '@/components/tools/media-tool-page'

export const Route = createFileRoute('/tools/srt')({
  component: ToolsSrtRoute,
})

function ToolsSrtRoute() {
  return (
    <MediaToolPage
      mode="srt"
      title="Audio to SRT"
      description="Upload audio and receive subtitle timing in SRT format."
    />
  )
}
