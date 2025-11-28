import { create } from 'zustand'

export interface Shift {
  _id?: string
  employeeId: string
  date: string // ISO date string
  startTime: string // HH:mm ou 'CP' ou 'AM'
  endTime: string // HH:mm ou 'CP' ou 'AM'
}

export interface Planning {
  _id: string
  weekStart: string // ISO date string (Monday)
  weekEnd: string // ISO date string (Sunday)
  shifts: Shift[]
  isValidated: boolean
  validatedAt: string | null
  createdAt: string
  updatedAt: string
}

// Timesheet types
export interface TimesheetDay {
  date: string
  type: 'work' | 'rest' | 'cp' | 'am'
  plannedStart: string | null
  plannedEnd: string | null
  plannedMinutes: number
  actualStart: string | null
  actualEnd: string | null
  actualMinutes: number
  deltaMinutes: number
  note: string
  modifications: Array<{
    changedAt: string
    field: string
    from: string
    to: string
  }>
}

export interface Timesheet {
  _id: string
  employeeId: string
  weekStart: string
  weekEnd: string
  days: TimesheetDay[]
  totalPlannedMinutes: number
  totalActualMinutes: number
  totalDeltaMinutes: number
}

interface PlanningState {
  currentWeekStart: Date
  planning: Planning | null
  timesheets: Timesheet[]
  isLoading: boolean
  error: string | null
  setCurrentWeek: (date: Date) => void
  goToNextWeek: () => void
  goToPreviousWeek: () => void
  goToToday: () => void
  setPlanning: (planning: Planning | null) => void
  setTimesheets: (timesheets: Timesheet[]) => void
  updateTimesheet: (employeeId: string, timesheet: Timesheet) => void
  addShift: (shift: Shift) => void
  updateShift: (shiftId: string, data: Partial<Shift>) => void
  deleteShift: (shiftId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// Get Monday of current week
const getMonday = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export const usePlanningStore = create<PlanningState>((set) => ({
  currentWeekStart: getMonday(new Date()),
  planning: null,
  timesheets: [],
  isLoading: false,
  error: null,
  
  setCurrentWeek: (date) => set({ currentWeekStart: getMonday(date) }),
  
  goToNextWeek: () => set((state) => {
    const next = new Date(state.currentWeekStart)
    next.setDate(next.getDate() + 7)
    return { currentWeekStart: next }
  }),
  
  goToPreviousWeek: () => set((state) => {
    const prev = new Date(state.currentWeekStart)
    prev.setDate(prev.getDate() - 7)
    return { currentWeekStart: prev }
  }),
  
  goToToday: () => set({ currentWeekStart: getMonday(new Date()) }),
  
  setPlanning: (planning) => set({ planning }),
  
  setTimesheets: (timesheets) => set({ timesheets }),
  
  updateTimesheet: (employeeId, timesheet) => set((state) => ({
    timesheets: state.timesheets.map(ts => 
      ts.employeeId === employeeId ? timesheet : ts
    )
  })),
  
  addShift: (shift) => set((state) => {
    if (!state.planning) return state
    return {
      planning: {
        ...state.planning,
        shifts: [...state.planning.shifts, shift]
      }
    }
  }),
  
  updateShift: (shiftId, data) => set((state) => {
    if (!state.planning) return state
    return {
      planning: {
        ...state.planning,
        shifts: state.planning.shifts.map((s) =>
          s._id === shiftId ? { ...s, ...data } : s
        )
      }
    }
  }),
  
  deleteShift: (shiftId) => set((state) => {
    if (!state.planning) return state
    return {
      planning: {
        ...state.planning,
        shifts: state.planning.shifts.filter((s) => s._id !== shiftId)
      }
    }
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
}))