import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Store {
  _id: string
  name: string
  role?: 'owner' | 'member'
}

interface User {
  _id: string
  email: string
  firstName: string
  lastName: string
  stores: Store[]
  currentStoreId: string | null
  companyName?: string // Pour compatibilité
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setCurrentStore: (storeId: string) => void
  getCurrentStore: () => Store | null
  getCurrentStoreRole: () => 'owner' | 'member' | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false
      }),

      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null
      })),

      setCurrentStore: (storeId) => set((state) => ({
        user: state.user ? { ...state.user, currentStoreId: storeId } : null
      })),

      getCurrentStore: () => {
        const state = get()
        if (!state.user || !state.user.stores) return null
        return state.user.stores.find(s => s._id === state.user?.currentStoreId) || null
      },

      getCurrentStoreRole: () => {
        const state = get()
        if (!state.user || !state.user.stores) return null
        const store = state.user.stores.find(s => s._id === state.user?.currentStoreId)
        return store?.role || null
      },
    }),
    {
      name: 'planify-auth',
    }
  )
)
