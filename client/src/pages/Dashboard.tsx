import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { format, startOfWeek, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../stores/authStore'
import { useEmployeesStore } from '../stores/employeesStore'
import { useSettingsStore } from '../stores/settingsStore'

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { employees } = useEmployeesStore()
  const { events } = useSettingsStore()
  
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  
  // Séparer événements en cours et à venir
  const currentEvents = events.filter(evt => {
    return evt.startDate <= todayStr && evt.endDate >= todayStr
  })
  
  const upcomingEvents = events.filter(evt => {
    return evt.startDate > todayStr
  })
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      
      {/* Greeting */}
      <section className="px-6 mb-6">
        <h1 className="text-2xl font-bold text-foreground font-heading">
          Bonjour, {user?.firstName || 'Manager'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité cette semaine.
        </p>
      </section>
      
      {/* Stats Cards */}
      <section className="px-6 space-y-4">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-primary shrink-0">
            <Icon icon="solar:users-group-two-rounded-bold" className="size-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{employees.length}</div>
            <div className="text-sm text-muted-foreground font-medium">Employés actifs</div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Icon icon="solar:chart-2-bold" className="size-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-2xl font-bold text-foreground">--</div>
              <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                À planifier
              </span>
            </div>
            <div className="text-sm text-muted-foreground font-medium mb-2">Semaine en cours</div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full w-0" />
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
            <Icon icon="solar:calendar-add-bold" className="size-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {currentEvents.length > 0 ? currentEvents.length : upcomingEvents.length}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {currentEvents.length > 0 
                ? `Événement${currentEvents.length > 1 ? 's' : ''} en cours` 
                : `Événement${upcomingEvents.length > 1 ? 's' : ''} à venir`}
            </div>
          </div>
        </div>
      </section>
      
      {/* Quick Actions */}
      <section className="px-6 py-8">
        <h2 className="text-lg font-semibold mb-4 font-heading">Actions Rapides</h2>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/planning')}
            className="flex flex-col items-center justify-center p-4 bg-primary text-primary-foreground rounded-xl shadow-sm active:scale-95 transition-transform h-32 text-center"
          >
            <div className="bg-white/20 p-2 rounded-full mb-3">
              <Icon icon="solar:calendar-mark-bold" className="size-6" />
            </div>
            <span className="text-sm font-semibold leading-tight">
              Planifier la<br />semaine
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/employees')}
            className="flex flex-col items-center justify-center p-4 bg-card border border-border text-card-foreground rounded-xl shadow-sm active:bg-secondary transition-colors h-32 text-center"
          >
            <div className="bg-secondary p-2 rounded-full mb-3 text-foreground">
              <Icon icon="solar:user-plus-bold" className="size-6" />
            </div>
            <span className="text-sm font-medium leading-tight">
              Ajouter un<br />employé
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center justify-center p-4 bg-card border border-border text-card-foreground rounded-xl shadow-sm active:bg-secondary transition-colors h-32 text-center"
          >
            <div className="bg-secondary p-2 rounded-full mb-3 text-foreground">
              <Icon icon="solar:calendar-minimalistic-bold" className="size-6" />
            </div>
            <span className="text-sm font-medium leading-tight">
              Voir les<br />événements
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center justify-center p-4 bg-card border border-border text-card-foreground rounded-xl shadow-sm active:bg-secondary transition-colors h-32 text-center"
          >
            <div className="bg-secondary p-2 rounded-full mb-3 text-foreground">
              <Icon icon="solar:settings-bold" className="size-6" />
            </div>
            <span className="text-sm font-medium leading-tight">
              Paramètres<br />généraux
            </span>
          </button>
        </div>
      </section>
      
      {/* Mini Week Preview */}
      <section className="px-6 pb-6">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-heading">Cette semaine</h2>
            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {format(weekStart, 'MMM d', { locale: fr })} - {format(weekEnd, 'd', { locale: fr })}
            </span>
          </div>
          
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <div className="size-16 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
                <Icon icon="solar:users-group-rounded-bold" className="size-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                Ajoutez des employés pour commencer à planifier
              </p>
              <button
                onClick={() => navigate('/employees')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
              >
                Ajouter un employé
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Week days header */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => {
                    const date = addDays(weekStart, i)
                    const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                    return (
                      <div 
                        key={i} 
                        className={`text-[10px] font-medium ${
                          isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                        }`}
                      >
                        {day}
                      </div>
                    )
                  })}
                </div>
                
                {/* Employee rows (show first 3) */}
                {employees.slice(0, 3).map((employee) => (
                  <div key={employee._id} className="flex items-center gap-3">
                    <div 
                      className="size-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: employee.color }}
                    >
                      {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                    </div>
                    <div className="flex-1 grid grid-cols-7 gap-1 h-6">
                      {Array.from({ length: 7 }).map((_, dayIndex) => (
                        <div 
                          key={dayIndex} 
                          className="rounded bg-secondary"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={() => navigate('/planning')}
                className="w-full mt-5 text-sm text-primary font-semibold flex items-center justify-center gap-1 hover:opacity-80 transition-opacity"
              >
                Voir le planning complet
                <Icon icon="solar:arrow-right-linear" className="size-4" />
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}