import { format, addDays, parseISO, differenceInMinutes } from 'date-fns'

export interface Shift {
  employeeId: string
  date: string
  startTime: string
  endTime: string
}

export interface LegalAlert {
  type: 'daily_max' | 'weekly_max' | 'overtime' | 'rest_between_days' | 'consecutive_days'
  severity: 'error' | 'warning'
  employeeId: string
  date?: string
  dates?: string[]
  message: string
  suggestion?: string
  value?: number
  limit?: number
}

// Convertir "HH:mm" en minutes depuis minuit
const timeToMinutes = (time: string): number => {
  if (!time || time === 'CP' || time === '00:00') return 0
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Calculer les heures travaillées sur un shift
const getShiftDuration = (shift: Shift): number => {
  if (!shift || shift.startTime === 'CP' || shift.startTime === '00:00') return 0
  const start = timeToMinutes(shift.startTime)
  const end = timeToMinutes(shift.endTime)
  return (end - start) / 60 // en heures
}

// Vérifier si un shift est un jour de repos ou CP
const isRestOrCP = (shift: Shift | undefined): boolean => {
  if (!shift) return true
  if (shift.startTime === 'CP' && shift.endTime === 'CP') return true
  if (shift.startTime === '00:00' && shift.endTime === '00:00') return true
  return false
}

/**
 * Vérifie toutes les règles légales pour un planning
 */
export function checkLegalAlerts(
  shifts: Shift[],
  weekStartDate: Date,
  employeeNames: Record<string, string>
): LegalAlert[] {
  const alerts: LegalAlert[] = []
  
  // Grouper les shifts par employé
  const shiftsByEmployee: Record<string, Shift[]> = {}
  shifts.forEach(shift => {
    if (!shiftsByEmployee[shift.employeeId]) {
      shiftsByEmployee[shift.employeeId] = []
    }
    shiftsByEmployee[shift.employeeId].push(shift)
  })
  
  // Vérifier pour chaque employé
  Object.entries(shiftsByEmployee).forEach(([employeeId, employeeShifts]) => {
    const employeeName = employeeNames[employeeId] || 'Employé'
    
    // 1. Vérifier durée max journalière (10h)
    employeeShifts.forEach(shift => {
      const duration = getShiftDuration(shift)
      if (duration > 10) {
        const suggestion = calculateDailySuggestion(shift, 10)
        alerts.push({
          type: 'daily_max',
          severity: 'error',
          employeeId,
          date: shift.date,
          message: `${employeeName} : ${duration.toFixed(1)}h le ${formatDateShort(shift.date)} (max 10h)`,
          suggestion,
          value: duration,
          limit: 10
        })
      }
    })
    
    // 2. Vérifier repos entre 2 jours (min 11h)
    const sortedShifts = [...employeeShifts].sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 0; i < sortedShifts.length - 1; i++) {
      const currentShift = sortedShifts[i]
      const nextShift = sortedShifts[i + 1]
      
      if (isRestOrCP(currentShift) || isRestOrCP(nextShift)) continue
      
      // Vérifier si jours consécutifs
      const currentDate = parseISO(currentShift.date)
      const nextDate = parseISO(nextShift.date)
      const daysDiff = Math.round((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff === 1) {
        // Calcul du repos : de la fin du jour 1 à 00h00 + de 00h00 au début du jour 2
        const endMinutes = timeToMinutes(currentShift.endTime)
        const startMinutes = timeToMinutes(nextShift.startTime)
        const restHours = ((24 * 60 - endMinutes) + startMinutes) / 60
        
        if (restHours < 11) {
          const suggestion = calculateRestSuggestion(currentShift, nextShift, 11)
          alerts.push({
            type: 'rest_between_days',
            severity: 'error',
            employeeId,
            date: nextShift.date,
            dates: [currentShift.date, nextShift.date],
            message: `${employeeName} : ${restHours.toFixed(1)}h de repos entre ${formatDateShort(currentShift.date)} et ${formatDateShort(nextShift.date)} (min 11h)`,
            suggestion,
            value: restHours,
            limit: 11
          })
        }
      }
    }
    
    // 3. Vérifier heures hebdomadaires (max 48h absolu, warning si > contrat)
    const weeklyHours = employeeShifts.reduce((total, shift) => {
      return total + getShiftDuration(shift)
    }, 0)
    
    // Alerte rouge : > 48h (interdit)
    if (weeklyHours > 48) {
      alerts.push({
        type: 'weekly_max',
        severity: 'error',
        employeeId,
        message: `${employeeName} : ${weeklyHours.toFixed(1)}h cette semaine (max 48h)`,
        suggestion: `Réduire de ${(weeklyHours - 48).toFixed(1)}h sur la semaine`,
        value: weeklyHours,
        limit: 48
      })
    } 
    // Alerte orange : > 35h (heures sup)
    else if (weeklyHours > 35) {
      alerts.push({
        type: 'overtime',
        severity: 'warning',
        employeeId,
        message: `${employeeName} : ${weeklyHours.toFixed(1)}h cette semaine (${(weeklyHours - 35).toFixed(1)}h sup)`,
        suggestion: `Heures supplémentaires à prévoir (+25% puis +50%)`,
        value: weeklyHours,
        limit: 35
      })
    }
    
    // 4. Vérifier jours consécutifs (max 6)
    const consecutiveDays = countConsecutiveWorkDays(employeeShifts, weekStartDate)
    if (consecutiveDays.count > 6) {
      alerts.push({
        type: 'consecutive_days',
        severity: 'error',
        employeeId,
        dates: consecutiveDays.dates,
        message: `${employeeName} : ${consecutiveDays.count} jours consécutifs (max 6)`,
        suggestion: `Ajouter un jour de repos`,
        value: consecutiveDays.count,
        limit: 6
      })
    }
  })
  
  return alerts
}

/**
 * Compte les jours consécutifs travaillés
 */
function countConsecutiveWorkDays(
  shifts: Shift[],
  weekStartDate: Date
): { count: number; dates: string[] } {
  // Créer un set des jours travaillés
  const workDays = new Set<string>()
  shifts.forEach(shift => {
    if (!isRestOrCP(shift)) {
      workDays.add(shift.date)
    }
  })
  
  // Compter les jours consécutifs dans la semaine
  let maxConsecutive = 0
  let currentConsecutive = 0
  let consecutiveDates: string[] = []
  let currentDates: string[] = []
  
  for (let i = 0; i < 7; i++) {
    const date = format(addDays(weekStartDate, i), 'yyyy-MM-dd')
    if (workDays.has(date)) {
      currentConsecutive++
      currentDates.push(date)
    } else {
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive
        consecutiveDates = [...currentDates]
      }
      currentConsecutive = 0
      currentDates = []
    }
  }
  
  // Vérifier à la fin de la boucle
  if (currentConsecutive > maxConsecutive) {
    maxConsecutive = currentConsecutive
    consecutiveDates = [...currentDates]
  }
  
  return { count: maxConsecutive, dates: consecutiveDates }
}

/**
 * Calcule une suggestion pour réduire la durée journalière
 */
function calculateDailySuggestion(shift: Shift, maxHours: number): string {
  const currentDuration = getShiftDuration(shift)
  const excessHours = currentDuration - maxHours
  
  // Option 1: Décaler le début
  const startMinutes = timeToMinutes(shift.startTime)
  const newStartMinutes = startMinutes + (excessHours * 60)
  const newStartHour = Math.floor(newStartMinutes / 60)
  const newStartMin = newStartMinutes % 60
  
  return `Commencer à ${String(newStartHour).padStart(2, '0')}:${String(newStartMin).padStart(2, '0')} ou finir plus tôt`
}

/**
 * Calcule une suggestion pour augmenter le repos entre 2 jours
 */
function calculateRestSuggestion(
  currentShift: Shift,
  nextShift: Shift,
  minRestHours: number
): string {
  const endMinutes = timeToMinutes(currentShift.endTime)
  const startMinutes = timeToMinutes(nextShift.startTime)
  const currentRest = ((24 * 60 - endMinutes) + startMinutes) / 60
  const missingHours = minRestHours - currentRest
  
  // Suggérer de décaler le début du lendemain
  const newStartMinutes = startMinutes + (missingHours * 60)
  const newStartHour = Math.floor(newStartMinutes / 60)
  const newStartMin = Math.round(newStartMinutes % 60)
  
  return `Décaler le début du ${formatDateShort(nextShift.date)} à ${String(newStartHour).padStart(2, '0')}:${String(newStartMin).padStart(2, '0')}`
}

/**
 * Formate une date en format court
 */
function formatDateShort(dateStr: string): string {
  const date = parseISO(dateStr)
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
  return days[date.getDay()]
}

/**
 * Vérifie si un jour spécifique a une alerte
 */
export function hasAlertForDay(
  alerts: LegalAlert[],
  employeeId: string,
  date: string
): LegalAlert | undefined {
  return alerts.find(alert => {
    if (alert.employeeId !== employeeId) return false
    if (alert.date === date) return true
    if (alert.dates?.includes(date)) return true
    return false
  })
}

/**
 * Compte les alertes par type
 */
export function countAlertsByType(alerts: LegalAlert[]): Record<string, number> {
  const counts: Record<string, number> = {
    daily_max: 0,
    weekly_max: 0,
    overtime: 0,
    rest_between_days: 0,
    consecutive_days: 0
  }
  
  alerts.forEach(alert => {
    counts[alert.type]++
  })
  
  return counts
}