import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { format, startOfWeek, addDays, addWeeks, differenceInWeeks, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Header } from '../components/layout/Header'
import { useAuthStore } from '../stores/authStore'
import { useEmployeesStore } from '../stores/employeesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePlanningStore } from '../stores/planningStore'
import { planningApi } from '../services/api'

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { employees } = useEmployeesStore()
  const { events, weekNumberConfig } = useSettingsStore()
  const { setCurrentWeek } = usePlanningStore()
  
  const [weekPlanning, setWeekPlanning] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)
  
  // Charger le planning de la semaine en cours
  useEffect(() => {
    const fetchWeekPlanning = async () => {
      try {
        setIsLoading(true)
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        const data = await planningApi.getByWeek(weekStartStr)
        setWeekPlanning(data)
      } catch (error) {
        console.error('Erreur chargement planning:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWeekPlanning()
  }, [])
  
  // Calculer le numéro de semaine
  const getWeekNumber = (date: Date) => {
    const refDate = parseISO(weekNumberConfig.referenceDate)
    const weeksDiff = differenceInWeeks(date, refDate)
    return weekNumberConfig.referenceWeekNumber + weeksDiff
  }
  const weekNumber = getWeekNumber(weekStart)
  
  // Générer les 4-5 semaines du mois en cours
  const getMonthWeeks = () => {
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const weeks = []
    
    let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    
    while (currentWeekStart <= monthEnd) {
      const currentWeekEnd = addDays(currentWeekStart, 6)
      weeks.push({
        start: currentWeekStart,
        end: currentWeekEnd,
        number: getWeekNumber(currentWeekStart),
        isCurrent: format(currentWeekStart, 'yyyy-MM-dd') === format(weekStart, 'yyyy-MM-dd')
      })
      currentWeekStart = addWeeks(currentWeekStart, 1)
    }
    
    return weeks
  }
  const monthWeeks = getMonthWeeks()
  
  // Naviguer vers une semaine spécifique
  const goToWeek = (weekStartDate: Date) => {
    setCurrentWeek(weekStartDate)
    navigate('/planning')
  }
  
  // Récupérer le shift d'un employé pour un jour
  const getShiftForDay = (employeeId: string, date: Date) => {
    if (!weekPlanning?.shifts) return null
    const dateStr = format(date, 'yyyy-MM-dd')
    return weekPlanning.shifts.find(
      (s: any) => s.employeeId === employeeId && s.date === dateStr
    )
  }
  
  // Séparer événements en cours et à venir
  const currentEvents = events.filter(evt => {
    return evt.startDate <= todayStr && evt.endDate >= todayStr
  })
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
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
      <section className="px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Employés actifs */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 text-center">
            <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-primary mx-auto mb-3">
              <Icon icon="solar:users-group-two-rounded-bold" className="size-6" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{employees.length}</div>
            <div className="text-sm text-muted-foreground font-medium">Employés actifs</div>
          </div>
          
          {/* Semaine en cours */}
          <div 
            className="bg-card rounded-xl p-5 shadow-sm border border-border/50 text-center cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => navigate('/planning')}
          >
            <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mx-auto mb-3">
              <Icon icon="solar:chart-2-bold" className="size-6" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">Semaine {weekNumber}</div>
            <div className="text-xs text-muted-foreground font-medium">
              {format(weekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM', { locale: fr })}
            </div>
          </div>
          
          {/* Événement en cours */}
          {currentEvents.length > 0 ? (
            <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 text-center">
              <div className="size-12 rounded-full bg-green-50 flex items-center justify-center text-green-500 mx-auto mb-3">
                <Icon icon="solar:calendar-mark-bold" className="size-6" />
              </div>
              <div className="text-sm font-semibold text-foreground mb-1">Événement en cours</div>
              <div className="text-xs text-muted-foreground">
                {currentEvents[0].emoji} {currentEvents[0].name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(currentEvents[0].startDate), 'd MMM', { locale: fr })} - {format(new Date(currentEvents[0].endDate), 'd MMM', { locale: fr })}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50 text-center">
              <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mx-auto mb-3">
                <Icon icon="solar:calendar-minimalistic-bold" className="size-6" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">0</div>
              <div className="text-sm text-muted-foreground font-medium">Événement en cours</div>
            </div>
          )}
        </div>
      </section>
      
      {/* Mini Week Preview - avec vraies données */}
      <section className="px-6 mt-8">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-heading">Cette semaine</h2>
            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {format(weekStart, 'd', { locale: fr })} - {format(weekEnd, 'd MMM', { locale: fr })}
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
              <div className="space-y-3">
                {/* Week days header */}
                <div className="grid grid-cols-[40px_1fr] gap-3">
                  <div></div>
                  <div className="grid grid-cols-7 gap-1 text-center">
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
                </div>
                
                {/* Employee rows avec vraies données */}
                {employees.slice(0, 5).map((employee) => (
                  <div key={employee._id} className="grid grid-cols-[40px_1fr] gap-3 items-center">
                    <div 
                      className="size-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: employee.color }}
                    >
                      {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }).map((_, dayIndex) => {
                        const date = addDays(weekStart, dayIndex)
                        const shift = getShiftForDay(employee._id, date)
                        const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                        const isRestDay = shift && shift.startTime === '00:00' && shift.endTime === '00:00'
                        const isCP = shift && shift.startTime === 'CP' && shift.endTime === 'CP'
                        const hasShift = shift && !isRestDay && !isCP
                        
                        return (
                          <div 
                            key={dayIndex} 
                            className={`h-7 rounded flex items-center justify-center text-[9px] font-medium ${
                              isLoading ? 'bg-secondary animate-pulse' :
                              isCP ? 'bg-orange-100 text-orange-600' :
                              isRestDay ? 'bg-secondary text-muted-foreground' :
                              hasShift ? 'text-white' : 'bg-secondary'
                            } ${isToday ? 'ring-1 ring-primary' : ''}`}
                            style={hasShift ? { backgroundColor: employee.color + '90' } : {}}
                          >
                            {!isLoading && (
                              isCP ? 'CP' :
                              isRestDay ? 'Repos' :
                              hasShift ? `${shift.startTime}-${shift.endTime}` : ''
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                
                {employees.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    +{employees.length - 5} autres employés
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => goToWeek(weekStart)}
                className="w-full mt-5 text-sm text-primary font-semibold flex items-center justify-center gap-1 hover:opacity-80 transition-opacity"
              >
                Modifier le planning
                <Icon icon="solar:arrow-right-linear" className="size-4" />
              </button>
            </>
          )}
        </div>
      </section>
      
      {/* Mois en cours - Navigation rapide */}
      <section className="px-6 mt-6 pb-6">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-heading">
              {format(today, 'MMMM yyyy', { locale: fr })}
            </h2>
            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-md">
              {monthWeeks.length} semaines
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {monthWeeks.map((week, index) => (
              <button
                key={index}
                onClick={() => goToWeek(week.start)}
                className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                  week.isCurrent 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : 'bg-secondary/50 border-border hover:bg-secondary'
                }`}
              >
                <div className={`text-sm font-bold mb-1 ${week.isCurrent ? 'text-primary' : 'text-foreground'}`}>
                  Semaine {week.number}
                </div>
                <div className={`text-xs ${week.isCurrent ? 'text-primary/80' : 'text-muted-foreground'}`}>
                  {format(week.start, 'd MMM', { locale: fr })} - {format(week.end, 'd MMM', { locale: fr })}
                </div>
                {week.isCurrent && (
                  <div className="mt-2 text-[10px] font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full inline-block">
                    En cours
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}