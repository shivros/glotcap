import type { ComponentProps } from 'react'

import { AlertDialogContent } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { APP_MODAL_CONTENT_CLASS } from '@/theme/semantic'

type AppModalContentProps = ComponentProps<typeof AlertDialogContent>

export function AppModalContent({ className, ...props }: AppModalContentProps) {
  return (
    <AlertDialogContent
      className={cn(APP_MODAL_CONTENT_CLASS, className)}
      {...props}
    />
  )
}
