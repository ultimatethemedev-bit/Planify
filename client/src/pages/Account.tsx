import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../utils/errors'

export function Account() {
  const { user, updateUser } = useAuthStore()
  
  // États pour le profil
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  
  // États pour le mot de passe
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // États pour les boutiques
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [editingStoreName, setEditingStoreName] = useState('')
  const [isUpdatingStore, setIsUpdatingStore] = useState(false)
  
  // Mettre à jour le profil
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error('Tous les champs sont requis')
      return
    }
    
    try {
      setIsUpdatingProfile(true)
      const response = await api.put('/user/profile', { firstName, lastName, email })
      
      updateUser(response.data.user)
      toast.success('Profil mis à jour avec succès')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la mise à jour du profil'))
    } finally {
      setIsUpdatingProfile(false)
    }
  }
  
  // Changer le mot de passe
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Tous les champs sont requis')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    
    try {
      setIsUpdatingPassword(true)
      await api.put('/user/password', { oldPassword, newPassword, confirmPassword })
      
      toast.success('Mot de passe modifié avec succès')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors du changement de mot de passe'))
    } finally {
      setIsUpdatingPassword(false)
    }
  }
  
  // Renommer une boutique
  const handleRenameStore = async (storeId: string) => {
    if (!editingStoreName.trim()) {
      toast.error('Le nom de la boutique est requis')
      return
    }
    
    try {
      setIsUpdatingStore(true)
      const response = await api.put(`/user/stores/${storeId}`, { name: editingStoreName })
      
      updateUser(response.data.user)
      toast.success('Boutique renommée avec succès')
      setEditingStoreId(null)
      setEditingStoreName('')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors du renommage de la boutique'))
    } finally {
      setIsUpdatingStore(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-2xl">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mon compte</h1>
            <p className="text-muted-foreground">Gérez vos informations personnelles</p>
          </div>
        </div>
        
        {/* Section Profil */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="solar:user-bold" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Profil</h2>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Prénom
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Votre prénom"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nom
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Votre nom"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="votre@email.com"
              />
            </div>
            
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>
        
        {/* Section Sécurité */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="solar:lock-password-bold" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Sécurité</h2>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ancien mot de passe
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  name="oldPassword"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-12 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon 
                    icon={showOldPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                    className="size-5" 
                  />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="newPassword"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-12 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon 
                      icon={showNewPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                      className="size-5" 
                    />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirmer nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-12 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon 
                      icon={showConfirmPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                      className="size-5" 
                    />
                  </button>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingPassword ? 'Modification...' : 'Changer mon mot de passe'}
            </button>
          </form>
        </div>
        
        {/* Section Mes Boutiques */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="solar:shop-bold" className="size-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Mes Boutiques</h2>
          </div>
          
          <div className="space-y-3">
            {user?.stores?.map((store) => (
              <div
                key={store._id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  store._id === user.currentStoreId
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon icon="solar:shop-2-bold" className="size-5 text-muted-foreground" />
                  
                  {editingStoreId === store._id ? (
                    <input
                      type="text"
                      value={editingStoreName}
                      onChange={(e) => setEditingStoreName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameStore(store._id)
                        } else if (e.key === 'Escape') {
                          setEditingStoreId(null)
                          setEditingStoreName('')
                        }
                      }}
                    />
                  ) : (
                    <span className="font-medium text-foreground">{store.name}</span>
                  )}

                  {store._id === user.currentStoreId && (
                    <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded">
                      Active
                    </span>
                  )}

                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    store.role === 'owner'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {store.role === 'owner' ? 'Proprietaire' : 'Membre'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {editingStoreId === store._id ? (
                    <>
                      <button
                        onClick={() => handleRenameStore(store._id)}
                        disabled={isUpdatingStore}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Icon icon="solar:check-circle-bold" className="size-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingStoreId(null)
                          setEditingStoreName('')
                        }}
                        disabled={isUpdatingStore}
                        className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Icon icon="solar:close-circle-bold" className="size-5" />
                      </button>
                    </>
                  ) : store.role === 'owner' ? (
                    <button
                      onClick={() => {
                        setEditingStoreId(store._id)
                        setEditingStoreName(store.name)
                      }}
                      className="p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Icon icon="solar:pen-bold" className="size-5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}