import { useState, useEffect, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useEmployeesStore } from '../../stores/employeesStore'
import { usePlanningStore, Shift } from '../../stores/planningStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { planningApi, timesheetsApi } from '../../services/api'
import { getShiftDuration, minutesToHours, calculateEmployeeCP } from '../../utils/planning'
import toast from 'react-hot-toast'

interface DayAlert {
  type: 'error' | 'warning'
  message: string
  suggestion?: string
}

interface DayShiftModalProps {
  employeeId: string
  date: Date
  weekStart: Date
  onClose: () => void
}

export function DayShiftModal({ employeeId, date, weekStart, onClose }: DayShiftModalProps) {
  const { employees } = useEmployeesStore()
  const { planning, setPlanning, timesheets, updateTimesheet } = usePlanningStore()
  const { shiftTemplates } = useSettingsStore()
  
  const employee = employees.find(e => e._id === employeeId)
  const dateStr = format(date, 'yyyy-MM-dd')
  const dayName = format(date, 'EEEE d MMMM', { locale: fr })
  
  // Détecter si le planning est validé
  const isValidated = planning?.isValidated || false
  
  // Trouver le timesheet de l'employé (si planning validé)
  const timesheet = useMemo(() => {
    if (!isValidated) return null
    return timesheets.find(ts => ts.employeeId === employeeId)
  }, [isValidated, timesheets, employeeId])
  
  // Trouver le jour dans le timesheet
  const timesheetDay = useMemo(() => {
    if (!timesheet) return null
    return timesheet.days.find(d => d.date === dateStr)
  }, [timesheet, dateStr])
  
  // Trouver le shift existant pour ce jour
  const existingShift = planning?.shifts?.find(
    s => s.employeeId === employeeId && s.date === dateStr
  )
  
  // États pour le mode EDITION (planning non validé)
  const [startTime, setStartTime] = useState(existingShift?.startTime || '')
  const [endTime, setEndTime] = useState(existingShift?.endTime || '')
  
  // États pour le mode TIMESHEET (planning validé)
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [dayType, setDayType] = useState<'work' | 'rest' | 'cp' | 'am'>('work')
  const [note, setNote] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  
  // Initialiser les états avec les données du timesheet
  useEffect(() => {
    if (timesheetDay) {
      setDayType(timesheetDay.type)
      setActualStart(timesheetDay.actualStart || '')
      setActualEnd(timesheetDay.actualEnd || '')
      setNote(timesheetDay.note || '')
    }
  }, [timesheetDay])
  
  // Pour le mode édition
  const isRestDay = startTime === '00:00' && endTime === '00:00'
  const isCP = startTime === 'CP' && endTime === 'CP'
  const isAM = startTime === 'AM' && endTime === 'AM'
  
  // Calculer les CP disponibles
  const cpData = useMemo(() => {
    if (!employee) return null
    const empShifts = planning?.shifts?.filter(s => s.employeeId === employeeId) || []
    return calculateEmployeeCP(
      {
        cpBalance: employee.cpBalance || 0,
        cpPerMonth: employee.cpPerMonth ?? 2.5,
        cpStartDate: employee.cpStartDate || employee.createdAt,
      },
      empShifts
    )
  }, [employee, planning, employeeId])
  
  // Calculer les alertes pour ce jour
  const dayAlerts = useMemo((): DayAlert[] => {
    const alerts: DayAlert[] = []
    
    // Si repos, CP ou AM, pas d'alertes
    if (isRestDay || isCP || isAM || !startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) {
      return alerts
    }
    
    // 1. Vérifier durée max 10h
    const duration = getShiftDuration(startTime, endTime)
    const hours = minutesToHours(duration)
    
    if (hours > 10) {
      const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
      const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])
      
      // Option 1: Commencer plus tard
      const suggestedStartMinutes = endMinutes - (10 * 60)
      const suggestedStart = `${Math.floor(suggestedStartMinutes / 60).toString().padStart(2, '0')}:${(suggestedStartMinutes % 60).toString().padStart(2, '0')}`
      
      // Option 2: Finir plus tôt
      const suggestedEndMinutes = startMinutes + (10 * 60)
      const suggestedEnd = `${Math.floor(suggestedEndMinutes / 60).toString().padStart(2, '0')}:${(suggestedEndMinutes % 60).toString().padStart(2, '0')}`
      
      alerts.push({
        type: 'error',
        message: `Dépassement des 10h/jour maximum (${hours}h)`,
        suggestion: `Commencer à ${suggestedStart} ou finir à ${suggestedEnd}`
      })
    }
    
    // 2. Vérifier repos 11h avec la veille
    const employeeShifts = planning?.shifts?.filter(s => s.employeeId === employeeId) || []
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
    const yesterdayShift = employeeShifts.find(s => s.date === yesterdayStr)
    
    if (yesterdayShift && yesterdayShift.startTime !== '00:00' && yesterdayShift.startTime !== 'CP') {
      const yesterdayEnd = new Date(`${yesterdayStr}T${yesterdayShift.endTime}`)
      const todayStart = new Date(`${dateStr}T${startTime}`)
      const restMinutes = differenceInMinutes(todayStart, yesterdayEnd)
      const restHours = minutesToHours(restMinutes)
      
      if (restHours < 11) {
        const neededMinutes = (11 * 60) - restMinutes
        const currentStartMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
        const suggestedStartMinutes = currentStartMinutes + neededMinutes
        const suggestedStart = `${Math.floor(suggestedStartMinutes / 60).toString().padStart(2, '0')}:${(suggestedStartMinutes % 60).toString().padStart(2, '0')}`
        
        alerts.push({
          type: 'error',
          message: `Moins de 11h de repos depuis hier (${restHours}h)`,
          suggestion: `Commencer à ${suggestedStart}`
        })
      }
    }
    
    // 3. Vérifier repos 11h avec le lendemain
    const tomorrow = new Date(date)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')
    const tomorrowShift = employeeShifts.find(s => s.date === tomorrowStr)
    
    if (tomorrowShift && tomorrowShift.startTime !== '00:00' && tomorrowShift.startTime !== 'CP') {
      const todayEnd = new Date(`${dateStr}T${endTime}`)
      const tomorrowStart = new Date(`${tomorrowStr}T${tomorrowShift.startTime}`)
      const restMinutes = differenceInMinutes(tomorrowStart, todayEnd)
      const restHours = minutesToHours(restMinutes)
      
      if (restHours < 11) {
        const neededMinutes = (11 * 60) - restMinutes
        const currentEndMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])
        const suggestedEndMinutes = currentEndMinutes - neededMinutes
        const suggestedEnd = `${Math.floor(suggestedEndMinutes / 60).toString().padStart(2, '0')}:${(suggestedEndMinutes % 60).toString().padStart(2, '0')}`
        
        alerts.push({
          type: 'error',
          message: `Moins de 11h de repos avant demain (${restHours}h)`,
          suggestion: `Terminer à ${suggestedEnd}`
        })
      }
    }
    
    return alerts
  }, [startTime, endTime, isRestDay, isCP, planning?.shifts, employeeId, date, dateStr])
  
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
  
  const applyAM = () => {
    setStartTime('AM')
    setEndTime('AM')
  }
  
  const applyRepos = () => {
    if (isValidated) {
      // Mode timesheet
      setDayType('rest')
      setActualStart('')
      setActualEnd('')
    } else {
      // Mode édition
      if (isRestDay) {
        setStartTime('')
        setEndTime('')
      } else {
        setStartTime('00:00')
        setEndTime('00:00')
      }
    }
  }
  
  // Calculer le delta (réalisé - prévu) en mode timesheet - EN TEMPS RÉEL
  const delta = useMemo(() => {
    if (!isValidated || !timesheetDay) return 0
    
    // Si les heures sont saisies, calculer en temps réel
    if (actualStart && actualEnd && actualStart.includes(':') && actualEnd.includes(':')) {
      const actualMinutes = getShiftDuration(actualStart, actualEnd)
      return actualMinutes - (timesheetDay.plannedMinutes || 0)
    }
    
    // Sinon utiliser les données sauvegardées
    return timesheetDay.deltaMinutes || 0
  }, [isValidated, timesheetDay, actualStart, actualEnd])
  
  const handleSave = async () => {
    setIsLoading(true)
    try {
      if (isValidated) {
        // MODE TIMESHEET : Mise à jour des heures réalisées
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        
        const payload: {
          weekStart: string
          date: string
          actualStart?: string
          actualEnd?: string
          note?: string
          type?: 'work' | 'rest' | 'cp' | 'am'
        } = {
          weekStart: weekStartStr,
          date: dateStr,
          type: dayType,
          note: note
        }
        
        // Ajouter les horaires seulement si c'est du travail
        if (dayType === 'work') {
          payload.actualStart = actualStart
          payload.actualEnd = actualEnd
        }
        
        const updatedTimesheet = await timesheetsApi.updateDay(employeeId, payload)
        updateTimesheet(employeeId, updatedTimesheet)
        toast.success('Heures réalisées enregistrées')
        onClose()
      } else {
        // MODE EDITION : Modification du planning (comme avant)
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
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setIsLoading(false)
    }
  }
  
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
  }, [isLoading, startTime, endTime])
  
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
        
        {/* CONTENU SELON MODE */}
        {!isValidated ? (
          // ==================== MODE EDITION ====================
          <>
            {/* Templates */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap gap-2">
                {templates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => applyTemplate(template)}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {template.name} ({template.startTime}-{template.endTime})
                  </button>
                ))}
                <button
                  onClick={applyCP}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCP 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white'
                  }`}
                >
                  CP
                </button>
                <button
                  onClick={applyAM}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isAM 
                      ? 'bg-red-500 text-white' 
                      : 'bg-red-100 text-red-600 hover:bg-red-500 hover:text-white'
                  }`}
                >
                  AM
                </button>
              </div>
            </div>
            
            {/* Horaires */}
            <div className="px-5 py-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                isRestDay ? 'border-muted bg-secondary/50' : 
                isCP ? 'border-orange-300 bg-orange-50' : 
                isAM ? 'border-red-300 bg-red-50' :
                'border-border'
              }`}>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={(isCP || isAM) ? '' : startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isCP || isAM}
                    placeholder={isCP ? 'CP' : isAM ? 'AM' : ''}
                    className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${
                      (isRestDay || isCP || isAM) ? 'opacity-50' : ''
                    }`}
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="time"
                    value={(isCP || isAM) ? '' : endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isCP || isAM}
                    placeholder={isCP ? 'CP' : isAM ? 'AM' : ''}
                    className={`bg-input border border-border rounded-lg px-3 py-2 text-sm w-full ${
                      (isRestDay || isCP || isAM) ? 'opacity-50' : ''
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
                        : isAM
                          ? 'bg-red-500 text-white'
                          : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  {isRestDay ? '✓ Repos' : isCP ? '✓ CP' : isAM ? '✓ AM' : 'Repos'}
                </button>
              </div>
              
              {/* Message AM */}
              {isAM && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:health-bold" className="size-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Arrêt maladie</span>
                  </div>
                </div>
              )}
              
              {isCP && cpData && (
                <div className={`mt-3 p-3 rounded-lg ${
                  cpData.cpAvailable < 0 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-orange-50 border border-orange-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${cpData.cpAvailable < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                      Congé payé
                    </span>
                    <span className={`text-sm font-bold ${cpData.cpAvailable < 0 ? 'text-red-700' : 'text-orange-700'}`}>
                      Solde : {cpData.cpAvailable} CP
                    </span>
                  </div>
                  {cpData.cpAvailable < 0 && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <Icon icon="solar:danger-triangle-bold" className="size-3" />
                      CP anticipés ({Math.abs(cpData.cpAvailable)} jours)
                    </p>
                  )}
                </div>
              )}
              
              {/* Alertes */}
              {dayAlerts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {dayAlerts.map((alert, index) => (
                    <div 
                      key={index}
                      className="bg-red-50 border border-red-200 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Icon icon="solar:danger-triangle-bold" className="size-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-red-700">{alert.message}</p>
                          {alert.suggestion && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <Icon icon="solar:lightbulb-bold" className="size-3" />
                              {alert.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // ==================== MODE TIMESHEET (PLANNING VALIDÉ) ====================
          <div className="px-5 py-4 space-y-4">
            {/* Prévu (readonly) */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
                Prévu (non modifiable)
              </label>
              <div className="bg-secondary/50 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon icon="solar:clock-circle-bold" className="size-5 text-muted-foreground" />
                    <span className="text-lg font-semibold text-foreground">
                      {timesheetDay?.plannedStart || '--:--'} - {timesheetDay?.plannedEnd || '--:--'}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {timesheetDay?.plannedMinutes ? minutesToHours(timesheetDay.plannedMinutes).toFixed(1) + 'h' : '0h'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Type de jour */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
                Type de jour
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDayType('work')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dayType === 'work'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  Travail
                </button>
                <button
                  onClick={() => setDayType('rest')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dayType === 'rest'
                      ? 'bg-gray-500 text-white'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  Repos
                </button>
                <button
                  onClick={() => setDayType('cp')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dayType === 'cp'
                      ? 'bg-orange-500 text-white'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  CP
                </button>
                <button
                  onClick={() => setDayType('am')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dayType === 'am'
                      ? 'bg-red-500 text-white'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  AM
                </button>
              </div>
            </div>
            
            {/* Réalisé (éditable si type = work) */}
            {dayType === 'work' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
                    Heures réalisées
                  </label>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={actualStart}
                        onChange={(e) => setActualStart(e.target.value)}
                        className="bg-input border border-border rounded-lg px-3 py-2 text-sm w-full"
                      />
                      <span className="text-muted-foreground">-</span>
                      <input
                        type="time"
                        value={actualEnd}
                        onChange={(e) => setActualEnd(e.target.value)}
                        className="bg-input border border-border rounded-lg px-3 py-2 text-sm w-full"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Delta */}
                {actualStart && actualEnd && timesheetDay && (
                  <div className={`p-3 rounded-lg border ${
                    delta > 0 
                      ? 'bg-green-50 border-green-200' 
                      : delta < 0 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-secondary/50 border-border'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Delta</span>
                      <span className={`text-lg font-bold ${
                        delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-foreground'
                      }`}>
                        {delta > 0 && '+'}
                        {delta} min
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
                Note (optionnelle)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Retard transport, Affluence..."
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
        )}
        
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