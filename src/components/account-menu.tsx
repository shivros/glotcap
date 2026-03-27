import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, Settings, Sparkles, User } from 'lucide-react'
import { useSafeConvexAuthActions as useAuthActions } from 'ts-common/auth/providers/convex/client'
import type { LucideIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type AccountMenuAction = {
  label: string
  icon: LucideIcon
  onSelect: () => void
  variant?: 'default' | 'destructive'
}

type AccountMenuViewProps = {
  actions: Array<AccountMenuAction>
  extraContent?: React.ReactNode
}

export function AccountMenuView({
  actions,
  extraContent,
}: AccountMenuViewProps) {
  const primaryActions = actions.filter(
    (action) => action.variant !== 'destructive',
  )
  const destructiveActions = actions.filter(
    (action) => action.variant === 'destructive',
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'gap-2',
        )}
      >
        <User className="size-4" />
        Account
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        {primaryActions.map((action) => (
          <DropdownMenuItem key={action.label} onClick={action.onSelect}>
            <action.icon className="size-4" />
            {action.label}
          </DropdownMenuItem>
        ))}
        {extraContent ? (
          <div className="px-1.5 py-1">{extraContent}</div>
        ) : null}
        {destructiveActions.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructiveActions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.variant}
            onClick={action.onSelect}
          >
            <action.icon className="size-4" />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AccountMenu({
  actions,
  extraContent,
}: {
  actions?: Array<AccountMenuAction>
  extraContent?: React.ReactNode
}) {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()

  const handleNavigate = useCallback(
    (to: '/app' | '/insights' | '/account') => {
      navigate({ to })
    },
    [navigate],
  )

  const defaultActions = useMemo<Array<AccountMenuAction>>(
    () => [
      {
        label: 'Live session',
        icon: Sparkles,
        onSelect: () => handleNavigate('/app'),
      },
      {
        label: 'Learning insights',
        icon: Sparkles,
        onSelect: () => handleNavigate('/insights'),
      },
      {
        label: 'Account settings',
        icon: Settings,
        onSelect: () => handleNavigate('/account'),
      },
      {
        label: 'Sign out',
        icon: User,
        onSelect: () => signOut(),
        variant: 'destructive',
      },
    ],
    [handleNavigate, signOut],
  )

  return (
    <AccountMenuView
      actions={actions ?? defaultActions}
      extraContent={extraContent}
    />
  )
}
