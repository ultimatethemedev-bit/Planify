import { format, parseISO, differenceInMinutes, addDays, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface Shift {
  employeeId: string
  date: string
  startTime: string
  endTime: string
}

export interface LegalAlert {
  type: 'error' | 'warning' | 'info'
  code: string
  message: string
  day?: string
  suggestion?: string
  startTime?: string
  endTime?: string
}

// Parse time string (HH:mm) to minutes since midnight
export const timeToMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return NaN
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (isNaN(hours) || isNaN(minutes)) return NaN
  return hours * 60 + minutes
}

// Convert minutes to hours (rounded to 2 decimals)
export const minutesToHours = (minutes: number): number => {
  return Math.round((minutes / 60) * 100) / 100
}

// Calculate shift duration in minutes
export const getShiftDuration = (startTime: string, endTime: string): number => {
  // Si c'est un jour de repos (00:00-00:00), durée = 0
  if (startTime === '00:00' && endTime === '00:00') {
    return 0
  }
  
  // Si c'est un CP
  if (startTime === 'CP' || endTime === 'CP') {
    return 0
  }
  
  // Si valeurs invalides ou vides
  if (!startTime || !endTime || !startTime.includes(':') || !endTime.includes(':')) {
    return 0
  }
  
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  
  // Vérifier que les valeurs sont valides
  if (isNaN(start) || isNaN(end)) {
    return 0
  }
  
  // Handle overnight shifts
  let adjustedEnd = end
  if (end < start) {
    adjustedEnd += 24 * 60
  }
  
  return adjustedEnd - start
}

// Check if shift is a rest day
export const isRestDay = (startTime: string, endTime: string): boolean => {
  return startTime === '00:00' && endTime === '00:00'
}

// Calculate total hours for an employee for a week
export const calculateWeeklyHours = (shifts: Shift[], employeeId: string): number => {
  const employeeShifts = shifts.filter(s => s.employeeId === employeeId)
  const totalMinutes = employeeShifts.reduce((acc, shift) => {
    const duration = getShiftDuration(shift.startTime, shift.endTime)
    // Protection contre NaN
    if (isNaN(duration)) return acc
    return acc + duration
  }, 0)
  const hours = minutesToHours(totalMinutes)
  // Protection finale contre NaN
  return isNaN(hours) ? 0 : hours
}

// Calculate hours per day for an employee
export const calculateDailyHours = (shifts: Shift[], employeeId: string, date: string): number => {
  const dayShifts = shifts.filter(s => 
    s.employeeId === employeeId && s.date === date
  )
  const totalMinutes = dayShifts.reduce((acc, shift) => {
    return acc + getShiftDuration(shift.startTime, shift.endTime)
  }, 0)
  return minutesToHours(totalMinutes)
}

// Check legal compliance and return alerts
export const checkLegalAlerts = (
  shifts: Shift[], 
  employeeId: string, 
  contractHours: number
): LegalAlert[] => {
  const alerts: LegalAlert[] = []
  const employeeShifts = shifts.filter(s => s.employeeId === employeeId)
  
  // Sort shifts by date
  const sortedShifts = [...employeeShifts].sort((a, b) => 
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  )
  
  // 1. Check daily hours (max 10h/day)
  const shiftsByDay = new Map<string, Shift[]>()
  sortedShifts.forEach(shift => {
    // Ignorer les jours de repos et CP
    if (shift.startTime === '00:00' || shift.startTime === 'CP') return
    const existing = shiftsByDay.get(shift.date) || []
    shiftsByDay.set(shift.date, [...existing, shift])
  })
  
  shiftsByDay.forEach((dayShifts, date) => {
    const totalMinutes = dayShifts.reduce((acc, s) => 
      acc + getShiftDuration(s.startTime, s.endTime), 0
    )
    const hours = minutesToHours(totalMinutes)
    
    if (hours > 10) {
      // Calculer les suggestions (basées sur le premier shift du jour)
      const firstShift = dayShifts[0]
      const startMinutes = timeToMinutes(firstShift.startTime)
      const endMinutes = timeToMinutes(firstShift.endTime)
      
      const suggestedStartMinutes = endMinutes - (10 * 60)
      const suggestedStart = `${Math.floor(suggestedStartMinutes / 60).toString().padStart(2, '0')}:${(suggestedStartMinutes % 60).toString().padStart(2, '0')}`
      
      const suggestedEndMinutes = startMinutes + (10 * 60)
      const suggestedEnd = `${Math.floor(suggestedEndMinutes / 60).toString().padStart(2, '0')}:${(suggestedEndMinutes % 60).toString().padStart(2, '0')}`
      
      alerts.push({
        type: 'error',
        code: 'MAX_DAILY_HOURS',
        message: `Dépassement des 10h/jour maximum (${hours}h)`,
        day: format(parseISO(date), 'EEEE', { locale: fr }),
        suggestion: `Commencer à ${suggestedStart} ou finir à ${suggestedEnd}`,
        startTime: firstShift.startTime,
        endTime: firstShift.endTime,
      })
    }
  })
  
  // 2. Check weekly hours (max 48h/week)
  const weeklyMinutes = sortedShifts.reduce((acc, s) => {
    if (s.startTime === '00:00' || s.startTime === 'CP') return acc
    return acc + getShiftDuration(s.startTime, s.endTime)
  }, 0)
  const weeklyHours = minutesToHours(weeklyMinutes)
  
  if (weeklyHours > 48) {
    alerts.push({
      type: 'error',
      code: 'MAX_WEEKLY_HOURS',
      message: `Dépassement des 48h/semaine maximum (${weeklyHours}h)`,
    })
  }
  
  // 3. Check 11h rest between shifts (only for consecutive work days)
  const workDayShifts = sortedShifts.filter(s => 
    s.startTime !== '00:00' && s.startTime !== 'CP'
  )
  
  for (let i = 0; i < workDayShifts.length - 1; i++) {
    const current = workDayShifts[i]
    const next = workDayShifts[i + 1]
    
    // Vérifier uniquement si jours consécutifs
    const currentDate = parseISO(current.date)
    const nextDate = parseISO(next.date)
    const daysDiff = Math.round((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff === 1) {
      const currentEnd = new Date(`${current.date}T${current.endTime}`)
      const nextStart = new Date(`${next.date}T${next.startTime}`)
      
      const restMinutes = differenceInMinutes(nextStart, currentEnd)
      const restHours = minutesToHours(restMinutes)
      
      if (restHours < 11) {
        alerts.push({
          type: 'error',
          code: 'MIN_REST_BETWEEN_SHIFTS',
          message: `Moins de 11h de repos entre deux journées (${restHours}h)`,
          day: format(nextDate, 'EEEE', { locale: fr }),
        })
      }
    }
  }
  
  // 4. Check max 6 consecutive work days
  const workDates = [...shiftsByDay.keys()].sort()
  let maxConsecutive = 0
  let currentConsecutive = 0
  let prevDate: Date | null = null
  
  workDates.forEach(dateStr => {
    const date = parseISO(dateStr)
    if (prevDate) {
      const daysDiff = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff === 1) {
        currentConsecutive++
      } else {
        currentConsecutive = 1
      }
    } else {
      currentConsecutive = 1
    }
    maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    prevDate = date
  })
  
  if (maxConsecutive > 6) {
    alerts.push({
      type: 'error',
      code: 'MAX_CONSECUTIVE_DAYS',
      message: `Plus de 6 jours consécutifs travaillés (${maxConsecutive} jours)`,
    })
  }
  
  return alerts
}

// Format date range for week display
export const formatWeekRange = (weekStart: Date): string => {
  const weekEnd = addDays(weekStart, 6)
  const startFormat = format(weekStart, 'EEE d MMM', { locale: fr })
  const endFormat = format(weekEnd, 'EEE d MMM yyyy', { locale: fr })
  return `${startFormat} - ${endFormat}`
}

// Get days of the week
export const getWeekDays = (weekStart: Date): Date[] => {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// Day names in French
export const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const DAYS_SHORT_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Employee colors
export const EMPLOYEE_COLORS = [
  { name: 'Bleu', value: '#3B82F6', bg: 'bg-blue-100', text: 'text-blue-700' },
  { name: 'Rose', value: '#EC4899', bg: 'bg-pink-100', text: 'text-pink-700' },
  { name: 'Vert', value: '#10B981', bg: 'bg-green-100', text: 'text-green-700' },
  { name: 'Orange', value: '#F59E0B', bg: 'bg-orange-100', text: 'text-orange-700' },
  { name: 'Violet', value: '#8B5CF6', bg: 'bg-purple-100', text: 'text-purple-700' },
  { name: 'Teal', value: '#14B8A6', bg: 'bg-teal-100', text: 'text-teal-700' },
  { name: 'Jaune', value: '#EAB308', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  { name: 'Rouge', value: '#EF4444', bg: 'bg-red-100', text: 'text-red-700' },
]

// Get color classes for an employee
export const getColorClasses = (colorValue: string) => {
  const color = EMPLOYEE_COLORS.find(c => c.value === colorValue)
  return color || EMPLOYEE_COLORS[0]
}

// Shift templates
export const SHIFT_TEMPLATES = [
  { name: 'Matin', startTime: '10:00', endTime: '14:00' },
  { name: 'Après-midi', startTime: '14:00', endTime: '21:00' },
  { name: 'Journée', startTime: '10:00', endTime: '21:00' },
]

// Calculate available CP for an employee
export interface CPCalculation {
  cpInitial: number       // Solde initial
  cpAcquired: number      // CP acquis depuis la date de début
  cpUsed: number          // CP posés sur le planning
  cpAvailable: number     // CP disponibles (peut être négatif = anticipés)
  monthsWorked: number    // Nombre de mois travaillés
}

export const calculateEmployeeCP = (
  employee: {
    cpBalance: number
    cpPerMonth: number
    cpStartDate: string
  },
  shifts: Shift[]
): CPCalculation => {
  // Calculer le nombre de mois depuis cpStartDate
  const startDate = new Date(employee.cpStartDate)
  const now = new Date()
  
  // Différence en mois (arrondi à l'inférieur pour ne compter que les mois complets)
  const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + 
                     (now.getMonth() - startDate.getMonth())
  const monthsWorked = Math.max(0, monthsDiff)
  
  // CP acquis depuis le début
  const cpAcquired = monthsWorked * (employee.cpPerMonth || 0)
  
  // Compter les CP utilisés (shifts avec startTime === 'CP')
  const cpUsed = shifts.filter(s => s.startTime === 'CP' && s.endTime === 'CP').length
  
  // CP disponibles
  const cpAvailable = (employee.cpBalance || 0) + cpAcquired - cpUsed
  
  return {
    cpInitial: employee.cpBalance || 0,
    cpAcquired: Math.round(cpAcquired * 10) / 10, // Arrondir à 1 décimale
    cpUsed,
    cpAvailable: Math.round(cpAvailable * 10) / 10,
    monthsWorked,
  }
}