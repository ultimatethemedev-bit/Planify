import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useEmployeesStore } from '../../stores/employeesStore'
import { usePlanningStore, Shift } from '../../stores/planningStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { planningApi } from '../../services/api'
import { 
  calculateWeeklyHours, 
  getWeekDays, 
  DAYS_FR, 
  checkLegalAlerts,
  LegalAlert 
} from '../../utils/planning'

interface ShiftHoursModalProps {
  employeeId: string
  weekStart: Date
  onClose: () => void
}

interface DayShift {
  startTime: string
  endTime: string
}

export function ShiftHoursModal({ employeeId, weekStart, onClose }: ShiftHoursModalProps) {
  const { employees } = useEmployeesStore()
  const { planning, setPlanning } = usePlanningStore()
  const { shiftTemplates } = useSettingsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [shifts, setShifts] = useState<Record<string, DayShift>>({})
  const [alerts, setAlerts] = useState<LegalAlert[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  
  const employee = employees.find(e => e._id === employeeId)
  const weekDays = getWeekDays(weekStart)
  
  // Initialize shifts from planning data
  useEffect(() => {
    const initialShifts: Record<string, DayShift> = {}
    weekDays.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const existingShift = planning?.shifts?.find(
        s => s.employeeId === employeeId && s.date === dateStr
      )
      initialShifts[dateStr] = existingShift 
        ? { startTime: existingShift.startTime, endTime: existingShift.endTime }
        : { startTime: '', endTime: '' }
    })
    setShifts(initialShifts)
  }, [employeeId, weekStart, planning])
  
  // Check legal alerts whenever shifts change
  useEffect(() => {
    if (!employee) return
    
    const shiftsArray: Shift[] = Object.entries(shifts)
      .filter(([_, shift]) => shift.startTime && shift.endTime)
      .map(([date, shift]) => ({
        employeeId,
        date,
        startTime: shift.startTime,
        endTime: shift.endTime,
      }))
    
    const legalAlerts = checkLegalAlerts(shiftsArray, employeeId, employee.weeklyHours)
    
    // Ajouter alerte si dépassement des heures contrat
    const totalHrs = calculateWeeklyHours(shiftsArray, employeeId)
    if (totalHrs > employee.weeklyHours) {
      const overtime = Math.round((totalHrs - employee.weeklyHours) * 100) / 100
      legalAlerts.push({
        type: 'warning',
        code: 'CONTRACT_HOURS_EXCEEDED',
        message: `Dépassement de ${overtime}h sur le contrat (${employee.weeklyHours}h)`,
      })
    }
    
    setAlerts(legalAlerts)
  }, [shifts, employeeId, employee])
  
  if (!employee) return null
  
  // Calculate total hours
  const shiftsArray: Shift[] = Object.entries(shifts)
    .filter(([_, shift]) => shift.startTime && shift.endTime)
    .map(([date, shift]) => ({
      employeeId,
      date,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }))
  const totalHours = calculateWeeklyHours(shiftsArray, employeeId)
  
  const handleTimeChange = (dateStr: string, field: 'startTime' | 'endTime', value: string) => {
    setShifts(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [field]: value
      }
    }))
  }
  
  const applyTemplate = (template: { name: string, startTime: string, endTime: string }) => {
    if (selectedDay) {
      // Appliquer au jour sélectionné uniquement
      setShifts(prev => ({
        ...prev,
        [selectedDay]: {
          startTime: template.startTime,
          endTime: template.endTime,
        }
      }))
      toast.success(`${template.name} appliqué à ${DAYS_FR[weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDay)]}`)
      setSelectedDay(null)
    } else {
      // Appliquer à tous les jours vides
      setShifts(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(dateStr => {
          if (!updated[dateStr].startTime && !updated[dateStr].endTime) {
            updated[dateStr] = {
              startTime: template.startTime,
              endTime: template.endTime,
            }
          }
        })
        return updated
      })
      toast.success(`Template "${template.name}" appliqué aux jours vides`)
    }
  }
  
  const applyCP = () => {
    if (selectedDay) {
      // Appliquer CP au jour sélectionné uniquement
      setShifts(prev => ({
        ...prev,
        [selectedDay]: {
          startTime: 'CP',
          endTime: 'CP',
        }
      }))
      toast.success(`CP appliqué à ${DAYS_FR[weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDay)]}`)
      setSelectedDay(null)
    } else {
      // Appliquer CP du lundi au vendredi (5 jours)
      setShifts(prev => {
        const updated = { ...prev }
        weekDays.forEach((date, index) => {
          // Index 0-4 = Lundi à Vendredi
          if (index >= 0 && index <= 4) {
            const dateStr = format(date, 'yyyy-MM-dd')
            updated[dateStr] = {
              startTime: 'CP',
              endTime: 'CP',
            }
          }
        })
        return updated
      })
      toast.success('CP appliqué du lundi au vendredi (5 jours)')
    }
  }
  
  const copyMondayToAll = () => {
    const mondayDateStr = format(weekDays[0], 'yyyy-MM-dd')
    const mondayShift = shifts[mondayDateStr]
    
    if (!mondayShift.startTime || !mondayShift.endTime) {
      toast.error('Définissez d\'abord les horaires du lundi')
      return
    }
    
    setShifts(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(dateStr => {
        if (dateStr !== mondayDateStr) {
          updated[dateStr] = { ...mondayShift }
        }
      })
      return updated
    })
    toast.success('Horaires copiés sur toute la semaine')
  }
  
  const handleSave = async () => {
    setIsLoading(true)
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      
      // Filter only days with actual work shifts (not rest days, not CP, not empty)
      const newShifts = Object.entries(shifts)
        .filter(([_, shift]) => {
          // Exclure les vides
          if (!shift.startTime || !shift.endTime) return false
          // Exclure les repos (00:00-00:00)
          if (shift.startTime === '00:00' && shift.endTime === '00:00') return false
          // Garder les CP et les vrais horaires
          return true
        })
        .map(([date, shift]) => ({
          employeeId,
          date,
          startTime: shift.startTime,
          endTime: shift.endTime,
        }))
      
      // Get other employees' shifts (only for current week dates)
      const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'))
      const otherShifts = planning?.shifts?.filter(s => 
        s.employeeId !== employeeId && weekDateStrs.includes(s.date)
      ) || []
      
      const response = await planningApi.createOrUpdate({
        weekStart: weekStartStr,
        shifts: [...otherShifts, ...newShifts],
      })
      
      setPlanning(response)
      toast.success('Planning enregistré')
      onClose()
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }
  
  const resetAllShifts = () => {
    const emptyShifts: Record<string, DayShift> = {}
    weekDays.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      emptyShifts[dateStr] = { startTime: '', endTime: '' }
    })
    setShifts(emptyShifts)
    toast.success('Horaires réinitialisés')
  }
  
  // Bloquer le scroll du body quand la modal est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])
  
  // Gestion touche Entrée pour sauvegarder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
        e.preventDefault()
        handleSave()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, shifts])
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div 
              className="size-12 sm:size-16 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0"
              style={{ backgroundColor: employee.color }}
            >
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-foreground font-heading truncate">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">{employee.weeklyHours}h/semaine</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors shrink-0"
          >
            <Icon icon="solar:close-circle-bold" className="size-6 text-muted-foreground" />
          </button>
        </div>
        
        {/* Templates */}
        <div className="px-4 sm:px-6 py-4">
          {selectedDay && (
            <p className="text-sm text-primary font-medium mb-3">
              📍 Sélection : {DAYS_FR[weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === selectedDay)]} — cliquez un template pour l'appliquer
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            {shiftTemplates.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                {template.name} ({template.startTime}-{template.endTime})
              </button>
            ))}
            <button
              onClick={applyCP}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              {selectedDay ? 'CP (1 jour)' : 'CP (5 jours)'}
            </button>
            <button
              onClick={resetAllShifts}
              className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              Réinitialiser
            </button>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                Annuler sélection
              </button>
            )}
          </div>
        </div>
        
        {/* Days */}
        <div className="px-4 sm:px-6 py-2 space-y-3">
          {weekDays.map((date, index) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayShift = shifts[dateStr] || { startTime: '', endTime: '' }
            const isSunday = index === 6
            const isRestDay = dayShift.startTime === '00:00' && dayShift.endTime === '00:00'
            const isCP = dayShift.startTime === 'CP' && dayShift.endTime === 'CP'
            const isSelected = selectedDay === dateStr
            
            return (
              <div 
                key={dateStr}
                className={`bg-card border rounded-2xl p-4 transition-colors cursor-pointer ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                    : isRestDay 
                      ? 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                      : isCP
                        ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                        : 'border-border hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 sm:w-24 font-semibold text-foreground cursor-pointer shrink-0"
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    title="Cliquer pour sélectionner ce jour"
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <Icon icon="solar:check-circle-bold" className="size-4 text-primary" />}
                      {DAYS_FR[index]}
                    </div>
                    {isRestDay && (
                      <span className="block text-[10px] text-muted-foreground font-normal">Repos</span>
                    )}
                    {isCP && (
                      <span className="block text-[10px] text-orange-700 font-normal">Congé payé</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="time"
                      value={isCP ? '' : dayShift.startTime}
                      onChange={(e) => handleTimeChange(dateStr, 'startTime', e.target.value)}
                      disabled={isCP}
                      className={`bg-input border border-border rounded-lg px-2 py-2 text-sm w-24 ${(isRestDay || isCP) ? 'opacity-50' : ''}`}
                      placeholder={isCP ? 'CP' : ''}
                    />
                    <span className="text-muted-foreground text-sm">-</span>
                    <input
                      type="time"
                      value={isCP ? '' : dayShift.endTime}
                      onChange={(e) => handleTimeChange(dateStr, 'endTime', e.target.value)}
                      disabled={isCP}
                      className={`bg-input border border-border rounded-lg px-2 py-2 text-sm w-24 ${(isRestDay || isCP) ? 'opacity-50' : ''}`}
                      placeholder={isCP ? 'CP' : ''}
                    />
                    <button
                      onClick={() => {
                        if (isRestDay) {
                          handleTimeChange(dateStr, 'startTime', '')
                          handleTimeChange(dateStr, 'endTime', '')
                        } else {
                          handleTimeChange(dateStr, 'startTime', '00:00')
                          handleTimeChange(dateStr, 'endTime', '00:00')
                        }
                      }}
                      className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        isRestDay 
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-muted'
                      }`}
                      title={isRestDay ? 'Annuler repos' : 'Marquer repos'}
                    >
                      <span className="hidden sm:inline">{isRestDay ? '✓ Repos' : 'Repos'}</span>
                      <span className="sm:hidden">{isRestDay ? '✓ R' : 'R'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (isCP) {
                          handleTimeChange(dateStr, 'startTime', '')
                          handleTimeChange(dateStr, 'endTime', '')
                        } else {
                          handleTimeChange(dateStr, 'startTime', 'CP')
                          handleTimeChange(dateStr, 'endTime', 'CP')
                        }
                      }}
                      className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        isCP 
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                      title={isCP ? 'Annuler CP' : 'Marquer CP'}
                    >
                      {isCP ? '✓ CP' : 'CP'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="px-6 py-2 space-y-2">
            {alerts.map((alert, index) => (
              <div 
                key={index}
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  alert.type === 'error' 
                    ? 'bg-red-50 text-red-700' 
                    : alert.type === 'warning'
                    ? 'bg-orange-50 text-orange-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                <Icon 
                  icon={
                    alert.type === 'error' 
                      ? 'solar:danger-triangle-bold' 
                      : alert.type === 'warning'
                      ? 'solar:info-circle-bold'
                      : 'solar:info-square-bold'
                  } 
                  className="size-5 shrink-0 mt-0.5" 
                />
                <div className="flex-1">
                  <span className="font-medium">{alert.message}</span>
                  {alert.day && <span className="text-xs ml-1">({alert.day})</span>}
                  {alert.suggestion && (
                    <p className="text-xs mt-1 flex items-center gap-1 opacity-80">
                      <Icon icon="solar:lightbulb-bold" className="size-3" />
                      {alert.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Total hours */}
        <div className="px-4 sm:px-6 py-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`text-lg sm:text-2xl font-bold ${
              totalHours > employee.weeklyHours 
                ? 'text-orange-500' 
                : totalHours === employee.weeklyHours 
                ? 'text-green-500' 
                : 'text-foreground'
            }`}>
              Total: {totalHours}h / {employee.weeklyHours}h
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-4 sm:px-6 py-4 flex gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="flex-1 px-4 sm:px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 sm:px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                <span className="hidden sm:inline">Enregistrement...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}