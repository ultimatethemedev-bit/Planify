import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'

const navItems = [
  { path: '/', icon: 'solar:home-2-bold', label: 'Accueil' },
  { path: '/planning', icon: 'solar:calendar-bold', label: 'Planning' },
  { path: '/employees', icon: 'solar:users-group-rounded-bold', label: 'Employés' },
  { path: '/settings', icon: 'solar:settings-bold', label: 'Réglages' },
]

export function Layout() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Main content with bottom padding for nav */}
      <main className="pb-24">
        <Outlet />
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex justify-around items-center pb-safe pt-2 h-[80px] px-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon icon={item.icon} className="size-6" />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
