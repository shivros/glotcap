import { createFileRoute } from '@tanstack/react-router'
import { MediaToolPage } from '@/components/tools/media-tool-page'

export const Route = createFileRoute('/tools/bilingual')({
  component: ToolsBilingualRoute,
})

function ToolsBilingualRoute() {
  return (
    <MediaToolPage
      mode="bilingual"
      title="Bilingual Transcript / SRT"
      description="Upload audio or SRT and generate alternating source + translation lines with a configurable delimiter."
    />
  )
}
