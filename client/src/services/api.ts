import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { StoreHours } from '../stores/settingsStore'
import type { Planning, Timesheet } from '../stores/planningStore'

// @ts-ignore - Vite import.meta.env
const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  register: async (userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    store1?: string
    store2?: string
    invitationCode?: string
  }) => {
    const { data } = await api.post('/auth/register', userData)
    return data
  },

  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },

  switchStore: async (storeId: string) => {
    const { data } = await api.put('/auth/switch-store', { storeId })
    return data
  },

  checkInvitationCode: async (code: string) => {
    const { data } = await api.get(`/auth/invitation-info/${code}`)
    return data as { storeName: string }
  },
}

// Employees API
export const employeesApi = {
  getAll: async () => {
    const { data } = await api.get('/employees')
    return data
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/employees/${id}`)
    return data
  },

  create: async (employeeData: {
    firstName: string
    lastName: string
    email: string
    phone: string
    contractType: string
    weeklyHours: number
    color: string
  }) => {
    const { data } = await api.post('/employees', employeeData)
    return data
  },

  update: async (id: string, employeeData: Partial<{
    firstName: string
    lastName: string
    email: string
    phone: string
    contractType: string
    weeklyHours: number
    color: string
  }>) => {
    const { data } = await api.put(`/employees/${id}`, employeeData)
    return data
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/employees/${id}`)
    return data
  },
}

// Planning API
export const planningApi = {
  getByWeek: async (weekStart: string): Promise<Planning> => {
    const { data } = await api.get(`/planning?weekStart=${weekStart}`)
    return data
  },

  createOrUpdate: async (planningData: {
    weekStart: string
    shifts: Array<{
      employeeId: string
      date: string
      startTime: string
      endTime: string
    }>
  }): Promise<Planning> => {
    const { data } = await api.post('/planning', planningData)
    return data
  },

  duplicate: async (sourceWeekStart: string, targetWeekStart: string): Promise<Planning> => {
    const { data } = await api.post('/planning/duplicate', {
      sourceWeekStart,
      targetWeekStart,
    })
    return data
  },

  delete: async (weekStart: string) => {
    const { data } = await api.delete(`/planning?weekStart=${weekStart}`)
    return data
  },
}

// Settings API
export const settingsApi = {
  getStoreHours: async () => {
    const { data } = await api.get('/settings/store-hours')
    return data
  },

  updateStoreHours: async (storeHours: StoreHours) => {
    const { data } = await api.put('/settings/store-hours', storeHours)
    return data
  },

  updateWeekNumberConfig: async (config: { referenceDate: string; referenceWeekNumber: number }) => {
    const { data } = await api.put('/settings/week-number-config', config)
    return data
  },

  getEvents: async () => {
    const { data } = await api.get('/settings/events')
    return data
  },

  createEvent: async (eventData: {
    name: string
    emoji: string
    startDate: string
    endDate: string
    color: string
  }) => {
    const { data } = await api.post('/settings/events', eventData)
    return data
  },

  updateEvent: async (id: string, eventData: Partial<{
    name: string
    emoji: string
    startDate: string
    endDate: string
    color: string
  }>) => {
    const { data } = await api.put(`/settings/events/${id}`, eventData)
    return data
  },

  deleteEvent: async (id: string) => {
    const { data } = await api.delete(`/settings/events/${id}`)
    return data
  },

  getShiftTemplates: async () => {
    const { data } = await api.get('/settings/shift-templates')
    return data
  },

  updateShiftTemplates: async (templates: Array<{
    name: string
    startTime: string
    endTime: string
  }>) => {
    const { data } = await api.put('/settings/shift-templates', templates)
    return data
  },

  getWeekNumberConfig: async () => {
    const { data } = await api.get('/settings/week-number-config')
    return data
  },
}

// Timesheets API
export const timesheetsApi = {
  validatePlanning: async (weekStart: string): Promise<{ message: string; planning: Planning; timesheets: Timesheet[] }> => {
    const { data } = await api.post('/timesheets/validate', { weekStart })
    return data
  },

  unvalidatePlanning: async (weekStart: string): Promise<{ message: string; planning: Planning; hadModifications: boolean; modificationsCount: number }> => {
    const { data } = await api.post('/timesheets/unvalidate', { weekStart })
    return data
  },

  getByWeek: async (weekStart: string): Promise<Timesheet[]> => {
    const { data } = await api.get('/timesheets', { params: { weekStart } })
    return data
  },

  getByEmployee: async (employeeId: string, month?: string, year?: string): Promise<Timesheet[]> => {
    const { data } = await api.get(`/timesheets/employee/${employeeId}`, {
      params: { month, year }
    })
    return data
  },

  updateDay: async (employeeId: string, payload: {
    weekStart: string
    date: string
    actualStart?: string
    actualEnd?: string
    note?: string
    type?: 'work' | 'rest' | 'cp' | 'am'
  }): Promise<Timesheet> => {
    const { data } = await api.put(`/timesheets/${employeeId}/day`, payload)
    return data
  },

  getSummary: async (employeeId: string, year?: number, month?: number) => {
    const { data } = await api.get(`/timesheets/summary/${employeeId}`, {
      params: { year, month }
    })
    return data
  },
}

// Stores API (invitations & members)
export const storesApi = {
  getMembers: async () => {
    const { data } = await api.get('/stores/current/members')
    return data as Array<{
      userId: string
      firstName: string
      lastName: string
      email: string
      role: 'owner' | 'member'
      joinedAt: string
    }>
  },

  createInvitation: async () => {
    const { data } = await api.post('/stores/invitations')
    return data as { code: string; expiresAt: string }
  },

  getInvitations: async () => {
    const { data } = await api.get('/stores/invitations')
    return data as Array<{
      code: string
      expiresAt: string
      createdAt: string
    }>
  },

  revokeInvitation: async (code: string) => {
    const { data } = await api.delete(`/stores/invitations/${code}`)
    return data
  },

  removeMember: async (userId: string) => {
    const { data } = await api.delete(`/stores/members/${userId}`)
    return data
  },
}
