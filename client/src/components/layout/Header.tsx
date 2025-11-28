import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useEmployeesStore } from '../../stores/employeesStore'
import { usePlanningStore } from '../../stores/planningStore'
import { authApi } from '../../services/api'
import toast from 'react-hot-toast'

interface HeaderProps {
  showAvatar?: boolean
  rightContent?: React.ReactNode
}

export function Header({ showAvatar = true, rightContent }: HeaderProps) {
  const { user, logout, setCurrentStore, getCurrentStore } = useAuthStore()
  const { setEmployees } = useEmployeesStore()
  const { setPlanning } = usePlanningStore()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showStoreSubmenu, setShowStoreSubmenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const currentStore = getCurrentStore()
  
  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
        setShowStoreSubmenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  const handleSwitchStore = async (storeId: string) => {
    try {
      await authApi.switchStore(storeId)
      setCurrentStore(storeId)
      // Reset les données pour forcer le rechargement
      setEmployees([])
      setPlanning(null)
      toast.success('Boutique changée')
      setShowMenu(false)
      setShowStoreSubmenu(false)
      // Rediriger vers le dashboard pour rafraîchir
      navigate('/')
      window.location.reload()
    } catch (error) {
      toast.error('Erreur lors du changement de boutique')
    }
  }
  
  return (
    <header className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
      {/* Logo - Clic retourne au Dashboard */}
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
          <Icon icon="solar:calendar-mark-bold" className="size-5" />
        </div>
        <span className="text-xl font-bold text-primary font-heading tracking-tight">
          Planify
        </span>
      </button>
      
      {rightContent ? rightContent : showAvatar && (
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="relative"
          >
            {user?.firstName ? (
              <div className="size-10 rounded-full border-2 border-background shadow-sm bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                {user.firstName.charAt(0)}{user.lastName?.charAt(0) || ''}
              </div>
            ) : (
              <div className="size-10 rounded-full border-2 border-background shadow-sm bg-secondary flex items-center justify-center">
                <Icon icon="solar:user-bold" className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-background rounded-full" />
          </button>
          
          {/* Menu déroulant */}
          {showMenu && (
            <div className="absolute right-0 top-12 w-64 bg-card rounded-xl shadow-lg border border-border py-2 animate-fade-in z-50">
              {/* Info utilisateur */}
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold text-foreground text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                {currentStore && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-primary">
                    <Icon icon="solar:shop-bold" className="size-3.5" />
                    <span className="font-medium">{currentStore.name}</span>
                  </div>
                )}
              </div>
              
              {/* Options du menu */}
              <div className="py-1">
                {/* Switch boutique */}
                {user?.stores && user.stores.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowStoreSubmenu(!showStoreSubmenu)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon icon="solar:shop-2-bold" className="size-5 text-muted-foreground" />
                        Changer de boutique
                      </div>
                      <Icon 
                        icon="solar:alt-arrow-right-linear" 
                        className={`size-4 text-muted-foreground transition-transform ${showStoreSubmenu ? 'rotate-90' : ''}`} 
                      />
                    </button>
                    
                    {/* Sous-menu boutiques */}
                    {showStoreSubmenu && (
                      <div className="bg-secondary/50 py-1">
                        {user.stores.map((store) => (
                          <button
                            key={store._id}
                            onClick={() => handleSwitchStore(store._id)}
                            className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${
                              store._id === user.currentStoreId 
                                ? 'text-primary bg-primary/10' 
                                : 'text-foreground hover:bg-secondary'
                            }`}
                          >
                            {store._id === user.currentStoreId && (
                              <Icon icon="solar:check-circle-bold" className="size-4" />
                            )}
                            <span className={store._id === user.currentStoreId ? 'font-medium' : ''}>
                              {store.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  onClick={() => {
                    navigate('/settings')
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Icon icon="solar:settings-bold" className="size-5 text-muted-foreground" />
                  Réglages
                </button>
                
                <button
                  onClick={() => {
                    // TODO: Ouvrir modal aide/support
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Icon icon="solar:question-circle-bold" className="size-5 text-muted-foreground" />
                  Aide
                </button>
              </div>
              
              {/* Déconnexion */}
              <div className="border-t border-border pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Icon icon="solar:logout-2-bold" className="size-5" />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}