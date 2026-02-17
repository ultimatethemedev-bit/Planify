import { useState, useEffect } from 'react'
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
  invitationCode: string
}

export function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [hasInvitationCode, setHasInvitationCode] = useState(false)
  const [invitationStoreName, setInvitationStoreName] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)

  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<RegisterForm>()
  const password = watch('password')
  const invitationCode = watch('invitationCode')

  // Check invitation code validity when it reaches 6 chars
  useEffect(() => {
    if (!invitationCode || invitationCode.length < 6) {
      setInvitationStoreName(null)
      return
    }

    const checkCode = async () => {
      setIsCheckingCode(true)
      try {
        const result = await authApi.checkInvitationCode(invitationCode)
        setInvitationStoreName(result.storeName)
      } catch {
        setInvitationStoreName(null)
      } finally {
        setIsCheckingCode(false)
      }
    }

    checkCode()
  }, [invitationCode])

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    try {
      const payload: Parameters<typeof authApi.register>[0] = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      }

      if (hasInvitationCode) {
        payload.invitationCode = data.invitationCode
      } else {
        payload.store1 = data.store1
        payload.store2 = data.store2 || ''
      }

      const response = await authApi.register(payload)
      login(response.user, response.token)
      toast.success('Compte cree avec succes !')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la creation du compte')
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
          Creer un compte
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          Simplifiez la gestion de votre planning
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Prenom
              </label>
              <input
                type="text"
                placeholder="Jean"
                className={`w-full px-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.firstName ? 'border-destructive' : 'border-border'
                }`}
                {...register('firstName', { required: 'Prenom requis' })}
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

          {/* Invitation code toggle */}
          <div className="bg-secondary/50 rounded-xl p-4">
            <button
              type="button"
              onClick={() => {
                setHasInvitationCode(!hasInvitationCode)
                setInvitationStoreName(null)
                setValue('invitationCode', '')
              }}
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
            >
              <div className={`size-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                hasInvitationCode ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {hasInvitationCode && (
                  <Icon icon="solar:check-read-bold" className="size-3.5 text-primary-foreground" />
                )}
              </div>
              J'ai un code d'invitation
            </button>

            {hasInvitationCode && (
              <div className="mt-3">
                <div className="relative">
                  <Icon
                    icon="solar:ticket-bold"
                    className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Ex: A3X9K2"
                    maxLength={6}
                    className={`w-full pl-12 pr-12 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground uppercase tracking-widest font-mono text-center text-lg ${
                      errors.invitationCode ? 'border-destructive' : 'border-border'
                    }`}
                    {...register('invitationCode', {
                      required: hasInvitationCode ? 'Code d\'invitation requis' : false,
                      minLength: { value: 6, message: 'Le code doit faire 6 caracteres' },
                      maxLength: { value: 6, message: 'Le code doit faire 6 caracteres' },
                    })}
                  />
                  {isCheckingCode && (
                    <Icon icon="solar:spinner-bold" className="size-5 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                  )}
                </div>
                {errors.invitationCode && (
                  <p className="text-destructive text-xs mt-1">{errors.invitationCode.message}</p>
                )}
                {invitationStoreName && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                    <Icon icon="solar:check-circle-bold" className="size-4" />
                    Vous rejoindrez la boutique <span className="font-semibold">{invitationStoreName}</span>
                  </div>
                )}
                {invitationCode && invitationCode.length >= 6 && !invitationStoreName && !isCheckingCode && (
                  <p className="text-destructive text-xs mt-1">Code invalide ou expire</p>
                )}
              </div>
            )}
          </div>

          {/* Store fields - hidden when using invitation code */}
          {!hasInvitationCode && (
            <>
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
                    placeholder="Boutique 1"
                    className={`w-full pl-12 pr-4 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                      errors.store1 ? 'border-destructive' : 'border-border'
                    }`}
                    {...register('store1', {
                      required: !hasInvitationCode ? 'Nom de la boutique 1 requis' : false,
                    })}
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
                    placeholder="Boutique 2"
                    className="w-full pl-12 pr-4 py-3 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground"
                    {...register('store2')}
                  />
                </div>
              </div>
            </>
          )}

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
                placeholder="Minimum 6 caracteres"
                className={`w-full pl-12 pr-12 py-3 bg-input border rounded-xl text-foreground placeholder:text-muted-foreground ${
                  errors.password ? 'border-destructive' : 'border-border'
                }`}
                {...register('password', {
                  required: 'Mot de passe requis',
                  minLength: {
                    value: 6,
                    message: 'Minimum 6 caracteres'
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
            disabled={isLoading || (hasInvitationCode && !invitationStoreName)}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                Creation...
              </>
            ) : hasInvitationCode ? (
              'Rejoindre la boutique'
            ) : (
              'Creer mon compte'
            )}
          </button>
        </form>

        <p className="text-center text-muted-foreground mt-6">
          Deja un compte ?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-muted-foreground text-sm mt-8">
        &copy; 2025 Planify. Simplifiez votre planning.
      </p>
    </div>
  )
}
