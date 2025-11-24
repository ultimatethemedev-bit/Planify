import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DayHours {
  isOpen: boolean
  openTime: string // HH:mm
  closeTime: string // HH:mm
}

export interface StoreHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

export interface CommercialEvent {
  _id: string
  name: string
  emoji: string
  startDate: string
  endDate: string
  color: string
}

export interface ShiftTemplate {
  name: string
  startTime: string
  endTime: string
}

export interface WeekNumberConfig {
  referenceDate: string  // Date de référence (ex: '2025-11-24')
  referenceWeekNumber: number  // Numéro de semaine pour cette date (ex: 42)
}

interface SettingsState {
  storeHours: StoreHours
  events: CommercialEvent[]
  shiftTemplates: ShiftTemplate[]
  weekNumberConfig: WeekNumberConfig
  isLoading: boolean
  error: string | null
  setStoreHours: (hours: StoreHours) => void
  updateDayHours: (day: keyof StoreHours, hours: DayHours) => void
  setEvents: (events: CommercialEvent[]) => void
  addEvent: (event: CommercialEvent) => void
  updateEvent: (id: string, data: Partial<CommercialEvent>) => void
  deleteEvent: (id: string) => void
  setShiftTemplates: (templates: ShiftTemplate[]) => void
  updateShiftTemplate: (index: number, template: ShiftTemplate) => void
  setWeekNumberConfig: (config: WeekNumberConfig) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const defaultStoreHours: StoreHours = {
  monday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  tuesday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  wednesday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  thursday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  friday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  saturday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
  sunday: { isOpen: true, openTime: '10:00', closeTime: '19:00' },
}

const defaultShiftTemplates: ShiftTemplate[] = [
  { name: 'Matin', startTime: '10:00', endTime: '14:00' },
  { name: 'Après-midi', startTime: '14:00', endTime: '21:00' },
  { name: 'Journée', startTime: '10:00', endTime: '21:00' },
]

const defaultWeekNumberConfig: WeekNumberConfig = {
  referenceDate: '2025-11-24',
  referenceWeekNumber: 48,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeHours: defaultStoreHours,
      events: [],
      shiftTemplates: defaultShiftTemplates,
      weekNumberConfig: defaultWeekNumberConfig,
      isLoading: false,
      error: null,
      
      setStoreHours: (storeHours) => set({ storeHours }),
      
      updateDayHours: (day, hours) => set((state) => ({
        storeHours: { ...state.storeHours, [day]: hours }
      })),
      
      setEvents: (events) => set({ events }),
      
      addEvent: (event) => set((state) => ({
        events: [...state.events, event]
      })),
      
      updateEvent: (id, data) => set((state) => ({
        events: state.events.map((evt) =>
          evt._id === id ? { ...evt, ...data } : evt
        )
      })),
      
      deleteEvent: (id) => set((state) => ({
        events: state.events.filter((evt) => evt._id !== id)
      })),
      
      setShiftTemplates: (shiftTemplates) => set({ shiftTemplates }),
      
      updateShiftTemplate: (index, template) => set((state) => ({
        shiftTemplates: state.shiftTemplates.map((t, i) => 
          i === index ? template : t
        )
      })),
      
      setWeekNumberConfig: (weekNumberConfig) => set({ weekNumberConfig }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
    }),
    {
      name: 'planify-settings',
    }
  )
)