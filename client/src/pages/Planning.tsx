import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format, addDays, addWeeks, differenceInWeeks, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePlanningStore } from '../stores/planningStore'
import { useEmployeesStore } from '../stores/employeesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { ShiftHoursModal } from '../components/planning/ShiftHoursModal'
import { calculateWeeklyHours, getWeekDays, getColorClasses, DAYS_SHORT_FR } from '../utils/planning'
import toast from 'react-hot-toast'

export function Planning() {
  const { currentWeekStart, goToNextWeek, goToPreviousWeek, planning, setPlanning } = usePlanningStore()
  const { employees } = useEmployeesStore()
  const { events, weekNumberConfig } = useSettingsStore()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isLoadingPlanning, setIsLoadingPlanning] = useState(false)
  
  const weekDays = getWeekDays(currentWeekStart)
  const weekEnd = addDays(currentWeekStart, 6)
  
  // Charger le planning de la semaine actuelle
  useEffect(() => {
    const fetchPlanning = async () => {
      try {
        setIsLoadingPlanning(true)
        const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
        const { planningApi } = await import('../services/api')
        const data = await planningApi.getByWeek(weekStartStr)
        setPlanning(data)
      } catch (error) {
        console.error('Erreur chargement planning:', error)
        setPlanning(null)
      } finally {
        setIsLoadingPlanning(false)
      }
    }
    
    fetchPlanning()
  }, [currentWeekStart, setPlanning])
  
  // Calculer le numéro de semaine basé sur la config
  const getWeekNumber = () => {
    const refDate = parseISO(weekNumberConfig.referenceDate)
    const weeksDiff = differenceInWeeks(currentWeekStart, refDate)
    return weekNumberConfig.referenceWeekNumber + weeksDiff
  }
  const weekNumber = getWeekNumber()
  
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
  
  const handleDuplicateWeek = async () => {
    if (!planning?.shifts || planning.shifts.length === 0) {
      toast.error('Aucun planning à dupliquer')
      return
    }
    
    setIsDuplicating(true)
    try {
      const nextWeekStart = addWeeks(currentWeekStart, 1)
      const nextWeekStartStr = format(nextWeekStart, 'yyyy-MM-dd')
      
      // Créer les nouveaux shifts pour la semaine suivante
      const duplicatedShifts = planning.shifts.map(shift => {
        const shiftDate = new Date(shift.date)
        const daysDiff = differenceInWeeks(shiftDate, currentWeekStart) * 7 + shiftDate.getDay() - currentWeekStart.getDay()
        const newDate = addDays(nextWeekStart, daysDiff)
        
        return {
          employeeId: shift.employeeId,
          date: format(newDate, 'yyyy-MM-dd'),
          startTime: shift.startTime,
          endTime: shift.endTime,
        }
      })
      
      // Charger le planning de la semaine suivante
      const { planningApi } = await import('../services/api')
      const existingNextWeekPlanning = await planningApi.getByWeek(nextWeekStartStr)
      
      // Fusionner avec les shifts existants (si il y en a)
      const otherShifts = existingNextWeekPlanning?.shifts || []
      const response = await planningApi.createOrUpdate({
        weekStart: nextWeekStartStr,
        shifts: [...otherShifts, ...duplicatedShifts],
      })
      
      toast.success('Planning dupliqué sur la semaine suivante')
      setShowDuplicateModal(false)
      
      // Naviguer vers la semaine suivante
      goToNextWeek()
    } catch (error) {
      toast.error('Erreur lors de la duplication')
    } finally {
      setIsDuplicating(false)
    }
  }
  
  const handleExportImage = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default
      const planningElement = document.querySelector('.planning-grid') as HTMLElement
      
      if (!planningElement) {
        toast.error('Impossible de capturer le planning')
        return
      }
      
      toast.loading('Génération de l\'image...', { id: 'export' })
      
      // Créer un container temporaire pour l'export
      const exportContainer = document.createElement('div')
      exportContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        background: white;
        padding: 32px;
        min-width: 1600px;
      `
      
      // Ajouter un titre
      const title = document.createElement('div')
      title.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 28px; font-weight: bold; color: #0F172A; margin: 0 0 8px 0; font-family: Inter, sans-serif;">
            Planning - Semaine ${weekNumber}
          </h1>
          <p style="font-size: 16px; color: #64748B; margin: 0; font-family: Inter, sans-serif;">
            ${format(currentWeekStart, 'd MMMM', { locale: fr })} - ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
      `
      exportContainer.appendChild(title)
      
      // Cloner le planning grid
      const clonedGrid = planningElement.cloneNode(true) as HTMLElement
      clonedGrid.style.cssText = `
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #E2E8F0;
        width: 100%;
      `
      
      // Retirer truncate sur les noms
      const truncatedElements = clonedGrid.querySelectorAll('.truncate')
      truncatedElements.forEach(el => {
        (el as HTMLElement).style.cssText = `
          overflow: visible;
          text-overflow: clip;
          white-space: nowrap;
        `
      })
      
      // Fix avatars (cercles avec initiales) - forcer centrage
      const avatars = clonedGrid.querySelectorAll('.rounded-full')
      avatars.forEach(el => {
        const element = el as HTMLElement
        // Seulement les cercles d'avatar (pas les petits points de couleur)
        if (element.classList.contains('size-12') || element.style.width === '48px') {
          element.style.display = 'flex'
          element.style.alignItems = 'center'
          element.style.justifyContent = 'center'
          element.style.textAlign = 'center'
        }
      })
      
      // Fix toutes les cards de shift (horaires, repos, CP)
      const allCells = clonedGrid.querySelectorAll('.p-2 > div, .p-2 > .bg-secondary, .p-2 > .bg-orange-100')
      allCells.forEach(el => {
        const element = el as HTMLElement
        const bgColor = window.getComputedStyle(element).backgroundColor
        // Si c'est une card colorée (pas transparent)
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          element.style.display = 'flex'
          element.style.alignItems = 'center'
          element.style.justifyContent = 'center'
          element.style.minHeight = '60px'
          element.style.textAlign = 'center'
        }
      })
      
      // Fix cards avec classe rounded-lg (shift cards)
      const shiftCards = clonedGrid.querySelectorAll('.rounded-lg')
      shiftCards.forEach(el => {
        const element = el as HTMLElement
        const bgColor = window.getComputedStyle(element).backgroundColor
        // Si c'est une card avec background (pas la grille)
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'rgb(255, 255, 255)') {
          element.style.display = 'flex'
          element.style.alignItems = 'center'
          element.style.justifyContent = 'center'
          element.style.minHeight = '60px'
          element.style.textAlign = 'center'
        }
      })
      
      exportContainer.appendChild(clonedGrid)
      
      // Ajouter au DOM temporairement
      document.body.appendChild(exportContainer)
      
      // Attendre pour le rendu complet
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Capturer
      const canvas = await html2canvas(exportContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      
      // Supprimer le container temporaire
      document.body.removeChild(exportContainer)
      
      // Télécharger
      const link = document.createElement('a')
      link.download = `planning-semaine-${weekNumber}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      
      toast.success('Planning exporté !', { id: 'export' })
    } catch (error) {
      console.error('Erreur export:', error)
      toast.error('Erreur lors de l\'export', { id: 'export' })
    }
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-20 no-print">
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
              <div className="text-xs font-semibold text-primary mb-0.5">
                Semaine {weekNumber}
              </div>
              <div className="text-xs sm:text-sm font-bold text-foreground">
                <span className="hidden sm:inline">{format(currentWeekStart, 'EEE d MMM', { locale: fr })} - {format(weekEnd, 'EEE d MMM yyyy', { locale: fr })}</span>
                <span className="sm:hidden">{format(currentWeekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM', { locale: fr })}</span>
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
          <div className="flex items-center gap-2 justify-end">
            <button 
              onClick={() => setShowDuplicateModal(true)}
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors hidden sm:flex"
              title="Dupliquer la semaine"
            >
              <Icon icon="solar:copy-bold" className="size-5" />
            </button>
            <button 
              onClick={handleExportImage}
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Exporter en image"
            >
              <Icon icon="solar:gallery-download-bold" className="size-5" />
            </button>
            <button 
              onClick={handlePrint}
              className="size-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Imprimer"
            >
              <Icon icon="solar:printer-bold" className="size-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Print-only header */}
      <div className="hidden print:block text-center py-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Planning - Semaine {weekNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {format(currentWeekStart, 'd MMM', { locale: fr })} - {format(weekEnd, 'd MMM yyyy', { locale: fr })}
        </p>
      </div>
      
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
        <div className="pb-24 px-4 mt-4">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full border border-border rounded-xl overflow-hidden shadow-sm planning-grid">
            {/* Event banner - aligned with planning */}
            {activeEvent && (
              <div 
                className="px-4 py-3 flex items-center gap-2"
                style={{ background: activeEvent.color }}
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
            
            {/* Days header */}
            <div className="flex bg-card border-b border-border sticky top-0 z-10">
              <div className="min-w-[280px] flex-shrink-0 px-4 py-3 font-semibold text-sm text-muted-foreground border-r border-border">
                Employés
              </div>
              <div className="flex flex-1">
                {weekDays.map((date, index) => {
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  return (
                    <div 
                      key={index} 
                      className={`flex-1 min-w-[120px] px-3 py-3 text-center border-r border-border last:border-r-0 ${
                        isToday ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {DAYS_SHORT_FR[index].toUpperCase()}
                      </div>
                      <div className={`text-xs ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(date, 'd/MM')}
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
                  <div className="min-w-[280px] flex-shrink-0 px-4 py-4 border-r border-border">
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
                  <div className="flex flex-1">
                    {weekDays.map((date, dayIndex) => {
                      const shift = getShiftForDay(employee._id, date)
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      const isRestDay = shift && shift.startTime === '00:00' && shift.endTime === '00:00'
                      const isCP = shift && shift.startTime === 'CP' && shift.endTime === 'CP'
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className={`flex-1 min-w-[120px] p-2 border-r border-border last:border-r-0 ${
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
                            ) : isCP ? (
                              <div className="bg-orange-100 rounded-lg p-2 h-full flex items-center justify-center">
                                <div className="text-xs font-bold text-orange-700">
                                  CP
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
      
      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Dupliquer le planning</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Voulez-vous copier le planning de la semaine {weekNumber} sur la semaine {weekNumber + 1} ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                disabled={isDuplicating}
                className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDuplicateWeek}
                disabled={isDuplicating}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDuplicating ? (
                  <>
                    <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                    Duplication...
                  </>
                ) : (
                  'Dupliquer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}