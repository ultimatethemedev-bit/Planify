import { create } from 'zustand'

export interface Employee {
  _id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  contractType: 'CDI' | 'CDD' | 'Alternant' | 'Stage'
  weeklyHours: number
  color: string
  avatar?: string
  // Gestion des CP
  cpBalance: number
  cpPerMonth: number
  cpStartDate: string
  createdAt: string
  updatedAt: string
}

interface EmployeesState {
  employees: Employee[]
  isLoading: boolean
  error: string | null
  setEmployees: (employees: Employee[]) => void
  addEmployee: (employee: Employee) => void
  updateEmployee: (id: string, data: Partial<Employee>) => void
  deleteEmployee: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useEmployeesStore = create<EmployeesState>((set) => ({
  employees: [],
  isLoading: false,
  error: null,
  
  setEmployees: (employees) => set({ employees }),
  
  addEmployee: (employee) => set((state) => ({ 
    employees: [...state.employees, employee] 
  })),
  
  updateEmployee: (id, data) => set((state) => ({
    employees: state.employees.map((emp) => 
      emp._id === id ? { ...emp, ...data } : emp
    )
  })),
  
  deleteEmployee: (id) => set((state) => ({
    employees: state.employees.filter((emp) => emp._id !== id)
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
}))