import { Icon } from '@iconify/react'
import { useAuthStore } from '../../stores/authStore'

interface HeaderProps {
  showAvatar?: boolean
  rightContent?: React.ReactNode
}

export function Header({ showAvatar = true, rightContent }: HeaderProps) {
  const { user } = useAuthStore()
  
  return (
    <header className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
          <Icon icon="solar:calendar-mark-bold" className="size-5" />
        </div>
        <span className="text-xl font-bold text-primary font-heading tracking-tight">
          Planify
        </span>
      </div>
      
      {rightContent ? rightContent : showAvatar && (
        <button className="relative">
          {user?.firstName ? (
            <div className="size-10 rounded-full border-2 border-background shadow-sm bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              {user.firstName.charAt(0)}{user.lastName?.charAt(0) || ''}
            </div>
          ) : (
            <div className="size-10 rounded-full border-2 border-background shadow-sm bg-secondary flex items-center justify-center">
              <Icon icon="solar:user-bold" className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-background rounded-full" />
        </button>
      )}
    </header>
  )
}
