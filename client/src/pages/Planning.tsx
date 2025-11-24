import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePlanningStore } from '../stores/planningStore'
import { useEmployeesStore } from '../stores/employeesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { ShiftHoursModal } from '../components/planning/ShiftHoursModal'
import { calculateWeeklyHours, getWeekDays, getColorClasses, DAYS_SHORT_FR } from '../utils/planning'

export function Planning() {
  const { currentWeekStart, goToNextWeek, goToPreviousWeek, planning } = usePlanningStore()
  const { employees } = useEmployeesStore()
  const { events } = useSettingsStore()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  
  const weekDays = getWeekDays(currentWeekStart)
  const weekEnd = addDays(currentWeekStart, 6)
  
  // Check if there's an active event this week
  const activeEvent = events.find(evt => {
    const eventStart = new Date(evt.startDate)
    const eventEnd = new Date(evt.endDate)
    return eventStart <= weekEnd && eventEnd >= currentWeekStart
  })
  
  // Get shifts for a specific employee and day
  const getShiftForDay = (employeeId: string, date: Date) => {
    if (!planning?.shifts) return null
    const dateStr = format(date, 'yyyy-MM-dd')
    return planning.shifts.find(
      s => s.employeeId === employeeId && s.date === dateStr
    )
  }
  
  const handleEmployeeClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId)
  }
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 w-32">
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Icon icon="solar:calendar-mark-bold" className="size-5" />
            </div>
            <span className="text-lg font-bold text-primary font-heading tracking-tight hidden sm:block">
              Planify
            </span>
          </div>
          
          {/* Week navigation */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            <button 
              onClick={goToPreviousWeek}
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
            >
              <Icon icon="solar:arrow-left-linear" className="size-5" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-foreground">
                {format(currentWeekStart, 'EEE d MMM', { locale: fr })} - {format(weekEnd, 'EEE d MMM yyyy', { locale: fr })}
              </div>
            </div>
            <button 
              onClick={goToNextWeek}
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
            >
              <Icon icon="solar:arrow-right-linear" className="size-5" />
            </button>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 w-32 justify-end">
            <button 
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Dupliquer la semaine"
            >
              <Icon icon="solar:copy-bold" className="size-5" />
            </button>
            <button 
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Exporter PDF"
            >
              <Icon icon="solar:document-bold" className="size-5" />
            </button>
            <button 
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Envoyer par email"
            >
              <Icon icon="solar:send-square-bold" className="size-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Event banner */}
      {activeEvent && (
        <div 
          className="px-4 py-3 flex items-center gap-2 shadow-sm"
          style={{ 
            background: `linear-gradient(to right, ${activeEvent.color}, ${activeEvent.color}dd)` 
          }}
        >
          <span className="text-xl">{activeEvent.emoji}</span>
          <span className="text-white font-semibold text-sm">
            {activeEvent.name} - {format(new Date(activeEvent.startDate), 'd MMM', { locale: fr })}
            {activeEvent.startDate !== activeEvent.endDate && (
              <> - {format(new Date(activeEvent.endDate), 'd MMM', { locale: fr })}</>
            )}
          </span>
        </div>
      )}
      
      {/* Planning grid */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="size-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Icon icon="solar:users-group-rounded-bold" className="size-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucun employé</h2>
          <p className="text-muted-foreground mb-6">
            Ajoutez des employés pour créer votre planning
          </p>
        </div>
      ) : (
        <div className="pb-24 flex justify-center">
          <div className="inline-block">
            {/* Days header */}
            <div className="flex bg-card border-b border-border sticky top-0 z-10">
              <div className="w-[200px] px-4 py-3 font-semibold text-sm text-muted-foreground border-r border-border shrink-0">
                Employés
              </div>
              <div className="flex">
                {weekDays.map((date, index) => {
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  return (
                    <div 
                      key={index} 
                      className={`w-[140px] px-3 py-3 text-center border-r border-border last:border-r-0 ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {DAYS_SHORT_FR[index].toUpperCase()}
                      </div>
                      <div className={`text-xs ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(date, 'd')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Employee rows */}
            {employees.map((employee) => {
              const weeklyHours = calculateWeeklyHours(planning?.shifts || [], employee._id)
              const colorClasses = getColorClasses(employee.color)
              
              return (
                <div 
                  key={employee._id} 
                  className="flex border-b border-border bg-card hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => handleEmployeeClick(employee._id)}
                >
                  {/* Employee info */}
                  <div className="w-[200px] px-4 py-4 border-r border-border shrink-0">
                    <div className="flex items-center gap-3">
                      <div 
                        className="size-12 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{ backgroundColor: employee.color }}
                      >
                        {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm text-foreground truncate">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div 
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: employee.color }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">{employee.weeklyHours}h/sem</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {weeklyHours}h/{employee.weeklyHours}h
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Shifts grid */}
                  <div className="flex">
                    {weekDays.map((date, dayIndex) => {
                      const shift = getShiftForDay(employee._id, date)
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      const isRestDay = shift && shift.startTime === '00:00' && shift.endTime === '00:00'
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className={`w-[140px] p-2 border-r border-border last:border-r-0 ${
                            isToday ? 'bg-primary/5' : ''
                          }`}
                        >
                          {shift ? (
                            isRestDay ? (
                              <div className="bg-secondary rounded-lg p-2 h-full flex items-center justify-center">
                                <div className="text-xs font-bold text-muted-foreground">
                                  Repos
                                </div>
                              </div>
                            ) : (
                              <div 
                                className={`${colorClasses.bg} rounded-lg p-2 h-full flex items-center justify-center`}
                              >
                                <div className={`text-xs font-bold ${colorClasses.text}`}>
                                  {shift.startTime}-{shift.endTime}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="border-2 border-dashed border-border rounded-lg h-full min-h-[40px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Icon icon="solar:add-circle-bold" className="size-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Shift Modal */}
      {selectedEmployeeId && (
        <ShiftHoursModal
          employeeId={selectedEmployeeId}
          weekStart={currentWeekStart}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  )
}