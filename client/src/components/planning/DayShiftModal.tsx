import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useEmployeesStore } from '../../stores/employeesStore'
import { usePlanningStore } from '../../stores/planningStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { planningApi } from '../../services/api'
import toast from 'react-hot-toast'

interface DayShiftModalProps {
  employeeId: string
  date: Date
  weekStart: Date
  onClose: () => void
}

export function DayShiftModal({ employeeId, date, weekStart, onClose }: DayShiftModalProps) {
  const { employees } = useEmployeesStore()
  const { planning, setPlanning } = usePlanningStore()
  const { shiftTemplates } = useSettingsStore()
  
  const employee = employees.find(e => e._id === employeeId)
  const dateStr = format(date, 'yyyy-MM-dd')
  const dayName = format(date, 'EEEE d MMMM', { locale: fr })
  
  // Trouver le shift existant pour ce jour
  const existingShift = planning?.shifts?.find(
    s => s.employeeId === employeeId && s.date === dateStr
  )
  
  const [startTime, setStartTime] = useState(existingShift?.startTime || '')
  const [endTime, setEndTime] = useState(existingShift?.endTime || '')
  const [isLoading, setIsLoading] = useState(false)
  
  const isRestDay = startTime === '00:00' && endTime === '00:00'
  const isCP = startTime === 'CP' && endTime === 'CP'
  
  // Templates par défaut + ceux de l'utilisateur
  const defaultTemplates = [
    { name: 'Matin', startTime: '10:00', endTime: '15:00' },
    { name: 'Après-midi', startTime: '13:00', endTime: '21:00' },
    { name: 'Journée', startTime: '10:00', endTime: '21:00' },
  ]
  const templates = shiftTemplates.length > 0 ? shiftTemplates : defaultTemplates
  
  const applyTemplate = (template: { startTime: string; endTime: string }) => {
    setStartTime(template.startTime)
    setEndTime(template.endTime)
  }
  
  const applyCP = () => {
    setStartTime('CP')
    setEndTime('CP')
  }
  
  const applyRepos = () => {
    if (isRestDay) {
      setStartTime('')
      setEndTime('')
    } else {
      setStartTime('00:00')
      setEndTime('00:00')
    }
  }
  
  const handleSave = async () => {
    setIsLoading(true)
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      
      // Récupérer tous les autres shifts (autres jours + autres employés)
      const otherShifts = planning?.shifts?.filter(
        s => !(s.employeeId === employeeId && s.date === dateStr)
      ) || []
      
      // Ajouter le nouveau shift si horaires définis
      const newShifts = [...otherShifts]
      if (startTime && endTime) {
        newShifts.push({
          employeeId,
          date: dateStr,
          startTime,
          endTime,
        })
      }
      
      const response = await planningApi.createOrUpdate({
        weekStart: weekStartStr,
        shifts: newShifts,
      })
      
      setPlanning(response)
      toast.success('Horaire enregistré')
      onClose()
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }
  
  if (!employee) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: employee.color }}
            >
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-foreground">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">{dayName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="size-5 text-muted-foreground" />
          </button>
        </div>
        
        {/* Templates */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template)}
                className="px-3 py-2 bg-secondary text-secondary-foreground rounded-full text-sm font-medium hover:bg-muted transition-colors"
              >
                {template.name} ({template.startTime}-{template.endTime})
              </button>
            ))}
            <button
              onClick={applyCP}
              className="px-3 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              CP
            </button>
          </div>
        </div>
        
        {/* Horaires */}
        <div className="px-5 py-4">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            isRestDay ? 'border-muted bg-secondary/50' : 
            isCP ? 'border-orange-300 bg-orange-50' : 
            'border-border'
          }`}>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="time"
                value={isCP ? '' : startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isCP}
                placeholder={isCP ? 'CP' : ''}
                className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${
                  (isRestDay || isCP) ? 'opacity-50' : ''
                }`}
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="time"
                value={isCP ? '' : endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isCP}
                placeholder={isCP ? 'CP' : ''}
                className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${
                  (isRestDay || isCP) ? 'opacity-50' : ''
                }`}
              />
            </div>
            <button
              onClick={applyRepos}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isRestDay 
                  ? 'bg-muted text-foreground' 
                  : isCP 
                    ? 'bg-orange-500 text-white'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {isRestDay ? '✓ Repos' : isCP ? '✓ CP' : 'Repos'}
            </button>
          </div>
          
          {isCP && (
            <p className="text-xs text-orange-600 mt-2 text-center">Congé payé</p>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                ...
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