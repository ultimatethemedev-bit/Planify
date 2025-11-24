import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useEmployeesStore } from '../../stores/employeesStore'
import { usePlanningStore, Shift } from '../../stores/planningStore'
import { planningApi } from '../../services/api'
import { 
  calculateWeeklyHours, 
  getWeekDays, 
  DAYS_FR, 
  SHIFT_TEMPLATES,
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
  const [isLoading, setIsLoading] = useState(false)
  const [shifts, setShifts] = useState<Record<string, DayShift>>({})
  const [alerts, setAlerts] = useState<LegalAlert[]>([])
  
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
    
    const newAlerts = checkLegalAlerts(shiftsArray, employeeId, employee.weeklyHours)
    setAlerts(newAlerts)
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
  
  const applyTemplate = (template: typeof SHIFT_TEMPLATES[0]) => {
    // Apply to all empty days
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
    toast.success(`Template "${template.name}" appliqué`)
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
      
      // Filter only days with shifts
      const newShifts = Object.entries(shifts)
        .filter(([_, shift]) => shift.startTime && shift.endTime)
        .map(([date, shift]) => ({
          employeeId,
          date,
          startTime: shift.startTime,
          endTime: shift.endTime,
        }))
      
      // Get other employees' shifts
      const otherShifts = planning?.shifts?.filter(s => s.employeeId !== employeeId) || []
      
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
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div 
              className="size-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ backgroundColor: employee.color }}
            >
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground font-heading">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{employee.weeklyHours}h/semaine</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="size-6 text-muted-foreground" />
          </button>
        </div>
        
        {/* Templates */}
        <div className="px-6 py-4 flex gap-3 flex-wrap">
          {SHIFT_TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => applyTemplate(template)}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {template.name} ({template.startTime}-{template.endTime})
            </button>
          ))}
          <button
            onClick={() => applyTemplate({ name: 'Repos', startTime: '00:00', endTime: '00:00' })}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Repos
          </button>
        </div>
        
        {/* Days */}
        <div className="px-6 py-2 space-y-3">
          {weekDays.map((date, index) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const dayShift = shifts[dateStr] || { startTime: '', endTime: '' }
            const isSunday = index === 6
            const isRestDay = dayShift.startTime === '00:00' && dayShift.endTime === '00:00'
            
            return (
              <div 
                key={dateStr}
                className={`bg-card border rounded-2xl p-4 hover:bg-accent/30 transition-colors ${
                  isSunday ? 'border-orange-200 bg-orange-50/30' : isRestDay ? 'border-gray-300 bg-gray-50' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-24 font-semibold text-foreground">
                    {DAYS_FR[index]}
                    {isSunday && !isRestDay && (
                      <span className="block text-[10px] text-orange-600 font-normal">+100%</span>
                    )}
                    {isRestDay && (
                      <span className="block text-[10px] text-muted-foreground font-normal">Repos</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 flex-1">
                      <Icon icon="solar:clock-circle-bold" className="size-5 text-muted-foreground" />
                      <input
                        type="time"
                        value={dayShift.startTime}
                        onChange={(e) => handleTimeChange(dateStr, 'startTime', e.target.value)}
                        className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${isRestDay ? 'opacity-50' : ''}`}
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex items-center gap-2 flex-1">
                      <Icon icon="solar:clock-circle-bold" className="size-5 text-muted-foreground" />
                      <input
                        type="time"
                        value={dayShift.endTime}
                        onChange={(e) => handleTimeChange(dateStr, 'endTime', e.target.value)}
                        className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${isRestDay ? 'opacity-50' : ''}`}
                      />
                    </div>
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
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isRestDay 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary text-secondary-foreground hover:bg-muted'
                      }`}
                      title={isRestDay ? 'Annuler repos' : 'Marquer repos'}
                    >
                      {isRestDay ? '✓ Repos' : 'Repos'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Copy Monday button */}
        <div className="px-6 py-4">
          <button 
            onClick={copyMondayToAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <Icon icon="solar:copy-bold" className="size-5" />
            <span>Copier Lundi sur toute la semaine</span>
          </button>
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
                <div>
                  <span className="font-medium">{alert.message}</span>
                  {alert.day && <span className="text-xs ml-1">({alert.day})</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Total hours */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`text-2xl font-bold ${
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
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                Enregistrement...
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