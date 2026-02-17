import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../services/api'
import { getErrorMessage } from '../utils/errors'

interface LoginForm {
  email: string
  password: string
}

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()
  
  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const response = await authApi.login(data.email, data.password)
      login(response.user, response.token)
      toast.success('Connexion réussie !')
      navigate('/')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur de connexion'))
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-secondary/50 flex flex-col justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="size-10 bg-primary rounded-md flex items-center justify-center text-primary-foreground">
          <Icon icon="solar:calendar-mark-bold" className="size-6" />
        </div>
        <span className="text-3xl font-bold text-primary tracking-tight">
          Planify
        </span>
      </div>

      {/* Form Card */}
      <div className="bg-card rounded-xl p-6 shadow-md border border-border max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">
          Bon retour
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          Connectez-vous pour gérer votre planning
        </p>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <Icon 
                icon="solar:letter-linear" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type="email"
                autoComplete="email"
                placeholder="exemple@email.com"
                className={`w-full pl-12 pr-4 py-3 bg-input border rounded-md text-foreground placeholder:text-muted-foreground ${
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
                icon="solar:lock-keyhole-linear" 
                className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full pl-12 pr-12 py-3 bg-input border rounded-md text-foreground placeholder:text-muted-foreground ${
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
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
        
        <p className="text-center text-muted-foreground mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Créer un compte
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