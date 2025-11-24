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
}

// Parse time string (HH:mm) to minutes since midnight
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
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
  
  const start = timeToMinutes(startTime)
  let end = timeToMinutes(endTime)
  
  // Handle overnight shifts
  if (end < start) {
    end += 24 * 60
  }
  
  return end - start
}

// Check if shift is a rest day
export const isRestDay = (startTime: string, endTime: string): boolean => {
  return startTime === '00:00' && endTime === '00:00'
}

// Calculate total hours for an employee for a week
export const calculateWeeklyHours = (shifts: Shift[], employeeId: string): number => {
  const employeeShifts = shifts.filter(s => s.employeeId === employeeId)
  const totalMinutes = employeeShifts.reduce((acc, shift) => {
    return acc + getShiftDuration(shift.startTime, shift.endTime)
  }, 0)
  return minutesToHours(totalMinutes)
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
    const existing = shiftsByDay.get(shift.date) || []
    shiftsByDay.set(shift.date, [...existing, shift])
  })
  
  shiftsByDay.forEach((dayShifts, date) => {
    const totalMinutes = dayShifts.reduce((acc, s) => 
      acc + getShiftDuration(s.startTime, s.endTime), 0
    )
    const hours = minutesToHours(totalMinutes)
    
    if (hours > 10) {
      alerts.push({
        type: 'error',
        code: 'MAX_DAILY_HOURS',
        message: `Dépassement des 10h/jour maximum (${hours}h)`,
        day: format(parseISO(date), 'EEEE', { locale: fr }),
      })
    }
  })
  
  // 2. Check weekly hours (max 48h/week)
  const weeklyMinutes = sortedShifts.reduce((acc, s) => 
    acc + getShiftDuration(s.startTime, s.endTime), 0
  )
  const weeklyHours = minutesToHours(weeklyMinutes)
  
  if (weeklyHours > 48) {
    alerts.push({
      type: 'error',
      code: 'MAX_WEEKLY_HOURS',
      message: `Dépassement des 48h/semaine maximum (${weeklyHours}h)`,
    })
  }
  
  // 3. Check 11h rest between shifts
  for (let i = 0; i < sortedShifts.length - 1; i++) {
    const current = sortedShifts[i]
    const next = sortedShifts[i + 1]
    
    const currentEnd = new Date(`${current.date}T${current.endTime}`)
    const nextStart = new Date(`${next.date}T${next.startTime}`)
    
    const restMinutes = differenceInMinutes(nextStart, currentEnd)
    const restHours = minutesToHours(restMinutes)
    
    if (restHours < 11 && current.date !== next.date) {
      alerts.push({
        type: 'error',
        code: 'MIN_REST_BETWEEN_SHIFTS',
        message: `Moins de 11h de repos entre deux journées (${restHours}h)`,
        day: format(parseISO(next.date), 'EEEE', { locale: fr }),
      })
    }
  }
  
  // 4. Check 24h consecutive rest per week
  const datesWorked = [...shiftsByDay.keys()].sort()
  if (datesWorked.length === 7) {
    alerts.push({
      type: 'error',
      code: 'NO_WEEKLY_REST',
      message: `Pas de repos hebdomadaire de 24h consécutives`,
    })
  }
  
  // 5. Check Sunday work (info about +100% bonus)
  sortedShifts.forEach(shift => {
    const date = parseISO(shift.date)
    if (date.getDay() === 0) {
      alerts.push({
        type: 'info',
        code: 'SUNDAY_WORK',
        message: `Travail le dimanche - majoration 100% applicable`,
        day: format(date, 'EEEE d MMMM', { locale: fr }),
      })
    }
  })
  
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