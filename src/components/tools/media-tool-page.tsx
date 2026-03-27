import { Navigate } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import type { MediaToolMode } from '@/lib/tools/use-media-tool-controller'
import { useMediaToolController } from '@/lib/tools/use-media-tool-controller'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageSpinner, Spinner } from '@/components/ui/spinner'

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
] as const

type MediaToolPageProps = {
  mode: MediaToolMode
  title: string
  description: string
}

const getTimestampLabel = (timestamp?: number) =>
  timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

export function MediaToolPage({
  mode,
  title,
  description,
}: MediaToolPageProps) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const controller = useMediaToolController(mode)

  if (isLoading) {
    return <PageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const downloadText = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Input File</label>
            <Input
              type="file"
              accept={mode === 'bilingual' ? 'audio/*,.srt' : 'audio/*'}
              onChange={(event) => {
                controller.setFile(event.target.files?.[0] ?? null)
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Source Language (Optional)
            </label>
            <Input
              value={controller.sourceLanguage}
              onChange={(event) =>
                controller.setSourceLanguage(event.target.value)
              }
              placeholder="e.g. en"
            />
          </div>

          {mode === 'bilingual' ? (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Target Language</label>
                <Select
                  value={controller.targetLanguage}
                  onValueChange={(next) => {
                    if (next) {
                      controller.setTargetLanguage(next)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Delimiter</label>
                <Input
                  value={controller.delimiter}
                  onChange={(event) =>
                    controller.setDelimiter(event.target.value)
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Bilingual Output</label>
                <Select
                  value={controller.bilingualOutput}
                  onValueChange={(next) => {
                    if (
                      next === 'transcript' ||
                      next === 'srt' ||
                      next === 'both'
                    ) {
                      controller.setBilingualOutput(next)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Transcript + SRT</SelectItem>
                    <SelectItem value="transcript">Transcript</SelectItem>
                    <SelectItem value="srt">SRT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {controller.localError ? (
            <p className="text-sm text-destructive">{controller.localError}</p>
          ) : null}

          <Button
            onClick={controller.submit}
            disabled={controller.isSubmitting}
          >
            {controller.isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                Uploading...
              </span>
            ) : (
              'Run Tool'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {controller.job ? (
            <div className="text-sm text-muted-foreground">
              Status:{' '}
              <span className="font-medium text-foreground">
                {controller.job.status}
              </span>
              {getTimestampLabel(controller.job.updatedAt) ? (
                <span>
                  {' '}
                  · Updated {getTimestampLabel(controller.job.updatedAt)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start a run to see output here.
            </p>
          )}

          {controller.isProcessing ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" />
              Processing...
            </div>
          ) : null}

          {controller.job?.status === 'failed' ? (
            <p className="text-sm text-destructive">
              {controller.job.errorMessage ?? 'Processing failed.'}
            </p>
          ) : null}

          {controller.primaryOutput ? (
            <>
              <Textarea
                value={controller.primaryOutput}
                readOnly
                className="min-h-[320px] font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      controller.primaryOutput,
                      controller.primaryOutputName,
                    )
                  }
                >
                  Download
                </Button>
                {mode === 'bilingual' &&
                controller.bilingualOutput !== 'transcript' &&
                controller.job?.bilingualSrtText ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        controller.job?.bilingualSrtText ?? '',
                        `${controller.file?.name.replace(/\.[^/.]+$/, '') || 'output'}.bilingual.srt`,
                      )
                    }
                  >
                    Download SRT
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
