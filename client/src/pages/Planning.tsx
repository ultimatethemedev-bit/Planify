import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { format, addDays, addWeeks, differenceInWeeks, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usePlanningStore } from '../stores/planningStore'
import { useEmployeesStore } from '../stores/employeesStore'
import { useSettingsStore, StoreHours } from '../stores/settingsStore'
import { ShiftHoursModal } from '../components/planning/ShiftHoursModal'
import { DayShiftModal } from '../components/planning/DayShiftModal'
import { calculateWeeklyHours, getWeekDays, getColorClasses, DAYS_SHORT_FR } from '../utils/planning'
import { checkLegalAlerts, hasAlertForDay } from '../utils/legalAlerts'
import { timesheetsApi } from '../services/api'
import toast from 'react-hot-toast'

export function Planning() {
  const navigate = useNavigate()
  const { currentWeekStart, goToNextWeek, goToPreviousWeek, planning, setPlanning, setTimesheets, timesheets } = usePlanningStore()
  const { employees } = useEmployeesStore()
  const { events, weekNumberConfig, storeHours } = useSettingsStore()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedDayData, setSelectedDayData] = useState<{ employeeId: string; date: Date } | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [, setIsLoadingPlanning] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isUnvalidating, setIsUnvalidating] = useState(false)
  const [showUnvalidateModal, setShowUnvalidateModal] = useState(false)
  
  // États pour le drag & drop
  const [draggedShift, setDraggedShift] = useState<{ employeeId: string; date: string; shift: any } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ employeeId: string; date: string } | null>(null)
  
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
        
        // Si le planning est validé, charger les timesheets
        if (data?.isValidated) {
          const timesheetsData = await timesheetsApi.getByWeek(weekStartStr)
          setTimesheets(timesheetsData)
        } else {
          setTimesheets([])
        }
      } catch (error) {
        console.error('Erreur chargement planning:', error)
        setPlanning(null)
        setTimesheets([])
      } finally {
        setIsLoadingPlanning(false)
      }
    }
    
    fetchPlanning()
  }, [currentWeekStart, setPlanning, setTimesheets])
  
  // Fonction pour valider le planning
  const handleValidatePlanning = async () => {
    if (!planning || planning.shifts.length === 0) {
      toast.error('Ajoutez des horaires avant de valider')
      return
    }
    
    try {
      setIsValidating(true)
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
      const result = await timesheetsApi.validatePlanning(weekStartStr)
      
      setPlanning(result.planning)
      setTimesheets(result.timesheets)
      toast.success('Planning validé ! Les heures sont maintenant trackées.')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la validation')
    } finally {
      setIsValidating(false)
    }
  }

  // Fonction pour dévalider le planning
  const handleUnvalidatePlanning = async () => {
    try {
      setIsUnvalidating(true)
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
      const result = await timesheetsApi.unvalidatePlanning(weekStartStr)

      setPlanning(result.planning)
      setTimesheets([])
      setShowUnvalidateModal(false)

      if (result.hadModifications) {
        toast.success(`Planning dévalidé. ${result.modificationsCount} modification(s) supprimée(s).`)
      } else {
        toast.success('Planning dévalidé. Vous pouvez maintenant le modifier.')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la dévalidation')
    } finally {
      setIsUnvalidating(false)
    }
  }

  // Calculer les alertes légales
  const legalAlerts = useMemo(() => {
    if (!planning?.shifts || planning.shifts.length === 0) return []
    
    // Créer un mapping des noms d'employés
    const employeeNames: Record<string, string> = {}
    employees.forEach(emp => {
      employeeNames[emp._id] = `${emp.firstName} ${emp.lastName}`
    })
    
    return checkLegalAlerts(planning.shifts, currentWeekStart, employeeNames)
  }, [planning?.shifts, currentWeekStart, employees])
  
  // Calculer les alertes de couverture boutique
  interface CoverageAlert {
    type: 'opening' | 'closing'
    dayIndex: number
    dayName: string
    storeTime: string
  }
  
  const coverageAlerts = useMemo((): CoverageAlert[] => {
    if (!planning?.shifts || employees.length === 0) return []
    
    const alerts: CoverageAlert[] = []
    const dayKeys: (keyof StoreHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    
    weekDays.forEach((date, dayIndex) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayKey = dayKeys[dayIndex]
      const dayConfig = storeHours[dayKey]
      
      // Si boutique fermée ce jour, pas de vérification
      if (!dayConfig.isOpen) return
      
      // Trouver tous les shifts pour ce jour (hors repos et CP)
      const dayShifts = planning.shifts.filter(s => 
        s.date === dateStr && 
        s.startTime !== '00:00' && 
        s.startTime !== 'CP'
      )
      
      // Si aucun shift ce jour - personne en ouverture ET en fermeture
      if (dayShifts.length === 0) {
        alerts.push({
          type: 'opening',
          dayIndex,
          dayName: dayNames[dayIndex],
          storeTime: dayConfig.openTime
        })
        alerts.push({
          type: 'closing',
          dayIndex,
          dayName: dayNames[dayIndex],
          storeTime: dayConfig.closeTime
        })
        return
      }
      
      // Vérifier ouverture : au moins un shift qui commence à l'heure d'ouverture
      const hasOpener = dayShifts.some(s => s.startTime <= dayConfig.openTime)
      if (!hasOpener) {
        alerts.push({
          type: 'opening',
          dayIndex,
          dayName: dayNames[dayIndex],
          storeTime: dayConfig.openTime
        })
      }
      
      // Vérifier fermeture : au moins un shift qui finit à l'heure de fermeture
      const hasCloser = dayShifts.some(s => s.endTime >= dayConfig.closeTime)
      if (!hasCloser) {
        alerts.push({
          type: 'closing',
          dayIndex,
          dayName: dayNames[dayIndex],
          storeTime: dayConfig.closeTime
        })
      }
    })
    
    return alerts
  }, [planning?.shifts, employees, weekDays, storeHours])
  
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
      
      // Créer les nouveaux shifts pour la semaine suivante (simple : +7 jours)
      const duplicatedShifts = planning.shifts.map(shift => ({
        employeeId: shift.employeeId,
        date: format(addDays(new Date(shift.date), 7), 'yyyy-MM-dd'),
        startTime: shift.startTime,
        endTime: shift.endTime,
      }))
      
      // Charger le planning de la semaine suivante
      const { planningApi } = await import('../services/api')
      const existingNextWeekPlanning = await planningApi.getByWeek(nextWeekStartStr)
      
      // Supprimer les shifts existants pour les employés concernés
      const employeeIds = new Set(planning.shifts.map(s => s.employeeId))
      const otherShifts = (existingNextWeekPlanning?.shifts || [])
        .filter((shift: any) => !employeeIds.has(shift.employeeId))
      
      // Remplacer les shifts (on garde les autres employés + on ajoute les shifts dupliqués)
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
      
      // NOUVELLE APPROCHE : Ajouter une classe CSS temporaire au planning
      const exportStyles = document.createElement('style')
      exportStyles.id = 'export-styles'
      exportStyles.textContent = `
        .export-mode .rounded-lg,
        .export-mode .p-2 > div {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 100% !important;
          min-height: 60px !important;
        }
        
        .export-mode .rounded-lg > *,
        .export-mode .p-2 > div > * {
          line-height: 1.2 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      `
      document.head.appendChild(exportStyles)
      planningElement.classList.add('export-mode')
      
      // Attendre que les styles s'appliquent
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Créer un container temporaire pour l'export
      const exportContainer = document.createElement('div')
      exportContainer.style.cssText = `
        position: absolute;
        left: 0;
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
      
      // Supprimer les styles temporaires
      planningElement.classList.remove('export-mode')
      document.getElementById('export-styles')?.remove()
      
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
  
  // Fonctions drag & drop
  const handleDragStart = (e: React.DragEvent, employeeId: string, dateStr: string, shift: any) => {
    // Bloquer le drag si planning validé
    if (planning?.isValidated) {
      e.preventDefault()
      toast.error('Planning validé, modification impossible')
      return
    }
    
    setDraggedShift({ employeeId, date: dateStr, shift })
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e: React.DragEvent, employeeId: string, dateStr: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget({ employeeId, date: dateStr })
  }
  
  const handleDragLeave = () => {
    setDropTarget(null)
  }
  
  const handleDrop = async (e: React.DragEvent, targetEmployeeId: string, targetDateStr: string) => {
    e.preventDefault()
    setDropTarget(null)
    
    if (!draggedShift || !planning) return
    
    // Si on drop sur la même case, rien à faire
    if (draggedShift.employeeId === targetEmployeeId && draggedShift.date === targetDateStr) {
      setDraggedShift(null)
      return
    }
    
    try {
      const { planningApi } = await import('../services/api')
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd')
      
      // Récupérer le shift de la case cible (si existe)
      const targetShift = planning.shifts?.find(
        s => s.employeeId === targetEmployeeId && s.date === targetDateStr
      )
      
      // Créer le nouveau tableau de shifts
      let newShifts = planning.shifts?.filter(
        s => !(s.employeeId === draggedShift.employeeId && s.date === draggedShift.date) &&
             !(s.employeeId === targetEmployeeId && s.date === targetDateStr)
      ) || []
      
      // Ajouter le shift draggé à la nouvelle position
      newShifts.push({
        employeeId: targetEmployeeId,
        date: targetDateStr,
        startTime: draggedShift.shift.startTime,
        endTime: draggedShift.shift.endTime,
      })
      
      // Si swap : ajouter le shift cible à l'ancienne position
      if (targetShift) {
        newShifts.push({
          employeeId: draggedShift.employeeId,
          date: draggedShift.date,
          startTime: targetShift.startTime,
          endTime: targetShift.endTime,
        })
      }
      
      // Sauvegarder
      const response = await planningApi.createOrUpdate({
        weekStart: weekStartStr,
        shifts: newShifts,
      })
      
      setPlanning(response)
      toast.success(targetShift ? 'Shifts échangés !' : 'Shift déplacé !')
    } catch (error) {
      console.error('Erreur drag & drop:', error)
      toast.error('Erreur lors du déplacement')
    } finally {
      setDraggedShift(null)
    }
  }
  
  const handleDragEnd = () => {
    setDraggedShift(null)
    setDropTarget(null)
  }
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          
          /* Masquer les éléments non imprimables */
          .no-print {
            display: none !important;
          }
          
          /* Forcer l'affichage des couleurs */
          body, * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
      
      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-20 no-print">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 w-32 hover:opacity-80 transition-opacity"
          >
            <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Icon icon="solar:calendar-mark-bold" className="size-5" />
            </div>
            <span className="text-lg font-bold text-primary font-heading tracking-tight hidden sm:block">
              Planify
            </span>
          </button>
          
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
            {/* Bouton Valider le planning */}
            {planning?.isValidated ? (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  <Icon icon="solar:check-circle-bold" className="size-4" />
                  Validé
                </div>
                <button
                  onClick={() => setShowUnvalidateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                  title="Dévalider le planning"
                >
                  <Icon icon="solar:restart-bold" className="size-4" />
                  Dévalider
                </button>
              </div>
            ) : (
              <button 
                onClick={handleValidatePlanning}
                disabled={isValidating || !planning?.shifts?.length}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Valider le planning"
              >
                {isValidating ? (
                  <Icon icon="solar:spinner-bold" className="size-4 animate-spin" />
                ) : (
                  <Icon icon="solar:check-circle-bold" className="size-4" />
                )}
                Valider
              </button>
            )}
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
      <div className="hidden print:block text-center py-6 mb-4">
        <h1 className="text-3xl font-bold text-foreground mb-2">Planning - Semaine {weekNumber}</h1>
        <p className="text-base text-muted-foreground">
          {format(currentWeekStart, 'd MMMM', { locale: fr })} - {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
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
        <div className="pb-24 px-4 mt-4 print:pb-0 print:px-0 print:mt-0">
          {/* Alertes de couverture boutique */}
          {coverageAlerts.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <Icon icon="solar:danger-triangle-bold" className="size-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-2">Couverture horaire incomplète</p>
                  
                  {/* Ligne ouvertures */}
                  {coverageAlerts.filter(a => a.type === 'opening').length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Icon icon="solar:sunrise-bold" className="size-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">Ouverture :</span>
                      {coverageAlerts.filter(a => a.type === 'opening').map((alert, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                        >
                          {alert.dayName} ({alert.storeTime})
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Ligne fermetures */}
                  {coverageAlerts.filter(a => a.type === 'closing').length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon icon="solar:sunset-bold" className="size-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">Fermeture :</span>
                      {coverageAlerts.filter(a => a.type === 'closing').map((alert, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs"
                        >
                          {alert.dayName} ({alert.storeTime})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
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
                  className="flex border-b border-border bg-card"
                >
                  {/* Employee info - Clic ouvre modal semaine complète */}
                  <div 
                    className="min-w-[280px] flex-shrink-0 px-4 py-4 border-r border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => handleEmployeeClick(employee._id)}
                  >
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
                          {/* Triangle alerte si dépassement heures contrat */}
                          {weeklyHours > employee.weeklyHours && (
                            <div title={`Dépassement de ${Math.round((weeklyHours - employee.weeklyHours) * 100) / 100}h`}>
                              <Icon icon="solar:danger-triangle-bold" className="size-4 text-orange-500" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{employee.weeklyHours}h/sem</div>
                        <div className={`text-xs mt-1 ${weeklyHours > employee.weeklyHours ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
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
                      const isAM = shift && shift.startTime === 'AM' && shift.endTime === 'AM'
                      const dateStr = format(date, 'yyyy-MM-dd')
                      const dayAlert = hasAlertForDay(legalAlerts, employee._id, dateStr)
                      
                      const isDropTarget = dropTarget?.employeeId === employee._id && dropTarget?.date === dateStr
                      const isDragging = draggedShift?.employeeId === employee._id && draggedShift?.date === dateStr
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className={`flex-1 min-w-[120px] p-2 border-r border-border last:border-r-0 transition-colors relative ${
                            isToday ? 'bg-primary/5' : ''
                          } ${isDropTarget ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-secondary/30'} ${isDragging ? 'opacity-50' : ''}`}
                          onClick={(e) => {
                            // Ne pas ouvrir la modal si on est en train de drag
                            if (!draggedShift) {
                              setSelectedDayData({ employeeId: employee._id, date })
                            }
                          }}
                          onDragOver={(e) => handleDragOver(e, employee._id, dateStr)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, employee._id, dateStr)}
                        >
                          {/* Indicateur d'alerte */}
                          {dayAlert && (
                            <div 
                              className="absolute top-1 right-1 z-10"
                              title={dayAlert.message}
                            >
                              <Icon icon="solar:danger-triangle-bold" className="size-4 text-red-500" />
                            </div>
                          )}
                          
                          {shift ? (
                            isRestDay ? (
                              <div 
                                draggable={!planning?.isValidated}
                                onDragStart={(e) => handleDragStart(e, employee._id, dateStr, shift)}
                                onDragEnd={handleDragEnd}
                                className="bg-secondary rounded-lg p-2 h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                              >
                                <div className="text-xs font-bold text-muted-foreground">
                                  Repos
                                </div>
                              </div>
                            ) : isCP ? (
                              <div 
                                draggable={!planning?.isValidated}
                                onDragStart={(e) => handleDragStart(e, employee._id, dateStr, shift)}
                                onDragEnd={handleDragEnd}
                                className="bg-orange-100 rounded-lg p-2 h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                              >
                                <div className="text-xs font-bold text-orange-700">
                                  CP
                                </div>
                              </div>
                            ) : isAM ? (
                              <div 
                                draggable={!planning?.isValidated}
                                onDragStart={(e) => handleDragStart(e, employee._id, dateStr, shift)}
                                onDragEnd={handleDragEnd}
                                className="bg-red-100 rounded-lg p-2 h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                              >
                                <div className="text-xs font-bold text-red-700">
                                  AM
                                </div>
                              </div>
                            ) : (
                              (() => {
                                // Trouver le timesheet de l'employé pour ce jour
                                const employeeTimesheet = timesheets.find(ts => ts.employeeId === employee._id)
                                const timesheetDay = employeeTimesheet?.days.find(d => d.date === dateStr)
                                
                                // Vérifier si les heures réalisées sont DIFFÉRENTES du prévu
                                const isModified = timesheetDay && 
                                  (timesheetDay.actualStart !== timesheetDay.plannedStart || 
                                   timesheetDay.actualEnd !== timesheetDay.plannedEnd)
                                
                                return (
                                  <div 
                                    draggable={!planning?.isValidated}
                                    onDragStart={(e) => handleDragStart(e, employee._id, dateStr, shift)}
                                    onDragEnd={handleDragEnd}
                                    className={`${colorClasses.bg} rounded-lg p-2 h-full flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing ${dayAlert ? 'ring-2 ring-red-400' : ''}`}
                                  >
                                    {/* Si planning validé ET heures réalisées MODIFIÉES */}
                                    {planning?.isValidated && isModified ? (
                                      <>
                                        {/* Horaires prévu (grisé, petite police) */}
                                        <div className="text-[10px] text-muted-foreground line-through opacity-60">
                                          {shift.startTime}-{shift.endTime}
                                        </div>
                                        {/* Horaires réalisé (couleur, grosse police) */}
                                        <div className={`text-xs font-bold ${colorClasses.text}`}>
                                          {timesheetDay.actualStart}-{timesheetDay.actualEnd}
                                        </div>
                                      </>
                                    ) : (
                                      /* Affichage normal si pas validé ou pas d'heures réalisées */
                                      <div className={`text-xs font-bold ${colorClasses.text}`}>
                                        {shift.startTime}-{shift.endTime}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()
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

      {/* Unvalidate Modal */}
      {showUnvalidateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Icon icon="solar:danger-triangle-bold" className="size-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Dévalider le planning</h3>
                <p className="text-sm text-muted-foreground">Semaine {weekNumber}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Cette action va supprimer les timesheets associés et permettre la modification du planning.
              {timesheets.length > 0 && (
                <span className="block mt-2 text-orange-600 font-medium">
                  ⚠️ Les heures réalisées déjà saisies seront perdues.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnvalidateModal(false)}
                disabled={isUnvalidating}
                className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleUnvalidatePlanning}
                disabled={isUnvalidating}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUnvalidating ? (
                  <>
                    <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                    Dévalidation...
                  </>
                ) : (
                  'Dévalider'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Shift Modal - Modal rapide pour un seul jour */}
      {selectedDayData && (
        <DayShiftModal
          employeeId={selectedDayData.employeeId}
          date={selectedDayData.date}
          weekStart={currentWeekStart}
          onClose={() => setSelectedDayData(null)}
        />
      )}
    </div>
  )
}