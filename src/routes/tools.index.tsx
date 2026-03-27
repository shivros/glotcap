import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/tools/')({
  component: ToolsIndexRoute,
})

const tools = [
  {
    href: '/tools/transcribe',
    title: 'Audio to Transcript',
    description: 'Upload audio and generate plain text transcription.',
  },
  {
    href: '/tools/srt',
    title: 'Audio to SRT',
    description: 'Upload audio and generate subtitle timing in SRT format.',
  },
  {
    href: '/tools/bilingual',
    title: 'Bilingual Subtitles',
    description:
      'Generate alternating source + translated lines with a configurable delimiter.',
  },
]

function ToolsIndexRoute() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          to="/app"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <h1 className="text-xl font-semibold">Media Tools</h1>
      </div>
      {tools.map((tool) => (
        <Card key={tool.href}>
          <CardHeader>
            <CardTitle>{tool.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">{tool.description}</p>
            <Link
              to={tool.href}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Open
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
