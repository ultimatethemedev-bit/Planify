import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

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
    companyName: string
  }) => {
    const { data } = await api.post('/auth/register', userData)
    return data
  },
  
  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
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
  getByWeek: async (weekStart: string) => {
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
  }) => {
    const { data } = await api.post('/planning', planningData)
    return data
  },
  
  duplicate: async (sourceWeekStart: string, targetWeekStart: string) => {
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
  
  updateStoreHours: async (storeHours: Record<string, {
    isOpen: boolean
    openTime: string
    closeTime: string
  }>) => {
    const { data } = await api.put('/settings/store-hours', storeHours)
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
  
  updateWeekNumberConfig: async (config: {
    referenceDate: string
    referenceWeekNumber: number
  }) => {
    const { data } = await api.put('/settings/week-number-config', config)
    return data
  },
}