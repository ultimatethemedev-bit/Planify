import { useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { useEmployeesStore } from '../../stores/employeesStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { employeesApi, settingsApi } from '../../services/api'

const navItems = [
  { path: '/', icon: 'solar:home-2-linear', activeIcon: 'solar:home-2-bold', label: 'Accueil' },
  { path: '/planning', icon: 'solar:calendar-linear', activeIcon: 'solar:calendar-bold', label: 'Planning' },
  { path: '/employees', icon: 'solar:users-group-rounded-linear', activeIcon: 'solar:users-group-rounded-bold', label: 'Employés' },
  { path: '/settings', icon: 'solar:settings-linear', activeIcon: 'solar:settings-bold', label: 'Réglages' },
]

export function Layout() {
  const location = useLocation()
  const { setEmployees, setLoading: setEmployeesLoading } = useEmployeesStore()
  const { setStoreHours, setShiftTemplates, setEvents, setWeekNumberConfig } = useSettingsStore()
  
  // Charger les données au démarrage
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Charger employés
        setEmployeesLoading(true)
        const employees = await employeesApi.getAll()
        setEmployees(employees)
        
        // Charger settings
        const [storeHours, templates, events, weekConfig] = await Promise.all([
          settingsApi.getStoreHours(),
          settingsApi.getShiftTemplates(),
          settingsApi.getEvents(),
          settingsApi.getWeekNumberConfig(),
        ])
        
        if (storeHours) setStoreHours(storeHours)
        if (templates) setShiftTemplates(templates)
        if (events) setEvents(events)
        if (weekConfig) setWeekNumberConfig(weekConfig)
      } catch (error) {
        console.error('Erreur chargement données:', error)
      } finally {
        setEmployeesLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
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
              className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors relative ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isActive && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full" />
              )}
              <Icon icon={isActive ? item.activeIcon : item.icon} className="size-6" />
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