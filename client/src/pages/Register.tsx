import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../services/api'

interface RegisterForm {
  firstName: string
  lastName: string
  store1: string
  store2: string
  email: string
  password: string
  confirmPassword: string
}

export function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>()
  const password = watch('password')
  
  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    try {
      const response = await authApi.register({
        firstName: data.firstName,
        lastName: data.lastName,
        store1: data.store1,
        store2: data.store2 || '',
        email: data.email,
        password: data.password,
      })
      login(response.user, response.token)
      toast.success('Compte créé avec succès !')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création du compte')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="size-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
          <Icon icon="solar:calendar-mark-bold" className="size-7" />
        </div>
        <span className="text-3xl font-bold text-primary font-heading tracking-tight">
          Planify
        </span>
      </div>
      
      {/* Form Card */}
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-foreground font-heading text-center mb-2">
          Créer un compte 🚀
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          Simplifiez la gestion de votre planning
        </p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Prénom
              </label>
              <input
                type="text"
                placeholder="Jean"
                className={`w-full px-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.firstName ? 'border-destructive' : 'border-border'
                }`}
                {...register('firstName', { required: 'Prénom requis' })}
              />
              {errors.firstName && (
                <p className="text-destructive text-xs mt-1">{errors.firstName.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nom
              </label>
              <input
                type="text"
                placeholder="Dupont"
                className={`w-full px-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.lastName ? 'border-destructive' : 'border-border'
                }`}
                {...register('lastName', { required: 'Nom requis' })}
              />
              {errors.lastName && (
                <p className="text-destructive text-xs mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Boutique 1 <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Icon 
                icon="solar:shop-bold" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type="text"
                placeholder="Parly 2"
                className={`w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.store1 ? 'border-destructive' : 'border-border'
                }`}
                {...register('store1', { required: 'Nom de la boutique 1 requis' })}
              />
            </div>
            {errors.store1 && (
              <p className="text-destructive text-sm mt-1">{errors.store1.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Boutique 2 <span className="text-muted-foreground text-xs">(optionnel)</span>
            </label>
            <div className="relative">
              <Icon 
                icon="solar:shop-bold" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type="text"
                placeholder="Vélizy 2"
                className="w-full pl-12 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                {...register('store2')}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <Icon 
                icon="solar:letter-bold" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type="email"
                placeholder="exemple@email.com"
                className={`w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.email ? 'border-destructive' : 'border-border'
                }`}
                {...register('email', { 
                  required: 'Email requis',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Email invalide'
                  }
                })}
              />
            </div>
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Icon 
                icon="solar:lock-keyhole-bold" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 6 caractères"
                className={`w-full pl-12 pr-12 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.password ? 'border-destructive' : 'border-border'
                }`}
                {...register('password', { 
                  required: 'Mot de passe requis',
                  minLength: {
                    value: 6,
                    message: 'Minimum 6 caractères'
                  }
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon 
                  icon={showPassword ? 'solar:eye-closed-bold' : 'solar:eye-bold'} 
                  className="size-5" 
                />
              </button>
            </div>
            {errors.password && (
              <p className="text-destructive text-sm mt-1">{errors.password.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Icon 
                icon="solar:lock-keyhole-bold" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmez votre mot de passe"
                className={`w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.confirmPassword ? 'border-destructive' : 'border-border'
                }`}
                {...register('confirmPassword', { 
                  required: 'Confirmation requise',
                  validate: value => value === password || 'Les mots de passe ne correspondent pas'
                })}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-destructive text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                Création...
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </form>
        
        <p className="text-center text-muted-foreground mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
      
      {/* Footer */}
      <p className="text-center text-muted-foreground text-sm mt-8">
        © 2025 Planify. Simplifiez votre planning.
      </p>
    </div>
  )
}