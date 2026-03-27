import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Languages, LogIn } from 'lucide-react'
import { SpeakingCoachAppView } from '@/components/speaking-coach-app'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { languageOptions } from '@/lib/speaking-coach-languages'
import { useDemoCoachController } from '@/lib/use-demo-coach-controller'

export const Route = createFileRoute('/demo')({
  component: DemoRoute,
})

function DemoRoute() {
  const controller = useDemoCoachController()

  const {
    activeLanguage,
    handleLanguageChange,
    isHydratingLanguagePreference,
    coachSession: { isBusy, isActive },
  } = controller

  const headerActions = (
    <div className="flex items-center gap-2">
      <Select
        value={activeLanguage.id}
        onValueChange={handleLanguageChange}
        disabled={isBusy || isActive || isHydratingLanguagePreference}
      >
        <SelectTrigger className="h-9 w-auto gap-1.5 border-input bg-card/75 px-2.5 text-sm">
          <Languages className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {languageOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="size-3.5" />
        Home
      </Link>
      <Link
        to="/"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        <LogIn className="size-3.5" />
        Sign up
      </Link>
    </div>
  )

  return (
    <SpeakingCoachAppView
      controller={controller}
      headerActions={headerActions}
    />
  )
}
