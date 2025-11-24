import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import { useEmployeesStore, Employee } from '../../stores/employeesStore'
import { employeesApi } from '../../services/api'
import { EMPLOYEE_COLORS } from '../../utils/planning'

interface AddEmployeeModalProps {
  employee?: Employee | null
  onClose: () => void
}

interface EmployeeForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  contractType: 'CDI' | 'CDD' | 'Intérim' | 'Stage'
  weeklyHours: number
}

export function AddEmployeeModal({ employee, onClose }: AddEmployeeModalProps) {
  const { employees, addEmployee, updateEmployee } = useEmployeesStore()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedColor, setSelectedColor] = useState(employee?.color || EMPLOYEE_COLORS[0].value)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(employee?.avatar || null)
  
  const isEditing = !!employee
  
  // Couleurs déjà utilisées par d'autres employés (sauf l'employé en cours d'édition)
  const usedColors = employees
    .filter(emp => emp._id !== employee?._id)
    .map(emp => emp.color)
  
  // Sélectionner la première couleur disponible par défaut
  useEffect(() => {
    if (!employee) {
      const firstAvailable = EMPLOYEE_COLORS.find(c => !usedColors.includes(c.value))
      if (firstAvailable) {
        setSelectedColor(firstAvailable.value)
      }
    }
  }, [employee, usedColors])
  
  // Gestion de l'upload de photo
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image trop lourde (max 2MB)')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Bloquer le scroll du body quand la modal est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeForm>({
    defaultValues: {
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      email: employee?.email || '',
      phone: employee?.phone || '',
      contractType: employee?.contractType || 'CDI',
      weeklyHours: employee?.weeklyHours || 35,
    }
  })
  
  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      reset({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        contractType: employee.contractType,
        weeklyHours: employee.weeklyHours,
      })
      setSelectedColor(employee.color)
    }
  }, [employee, reset])
  
  const onSubmit = async (data: EmployeeForm) => {
    setIsLoading(true)
    try {
      const employeeData = {
        ...data,
        color: selectedColor,
        avatar: avatarPreview,
      }
      
      if (isEditing && employee) {
        const updated = await employeesApi.update(employee._id, employeeData)
        updateEmployee(employee._id, updated)
        toast.success('Employé modifié')
      } else {
        const created = await employeesApi.create(employeeData)
        addEmployee(created)
        toast.success('Employé ajouté')
      }
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-semibold text-foreground font-heading">
            {isEditing ? 'Modifier employé' : 'Nouvel employé'}
          </h2>
          <button 
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="size-6 text-muted-foreground" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-5">
          {/* Avatar upload */}
          <div className="flex justify-center">
            <label className="cursor-pointer group relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <div 
                className="size-24 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden transition-transform group-hover:scale-105"
                style={{ backgroundColor: selectedColor }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Icon icon="solar:camera-bold" className="size-8" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon icon="solar:camera-bold" className="size-8 text-white" />
              </div>
            </label>
          </div>
          
          {/* First name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Prénom</label>
            <input
              type="text"
              placeholder="Entrez le prénom"
              className={`w-full px-4 py-3 bg-input border rounded-lg text-foreground ${
                errors.firstName ? 'border-destructive' : 'border-border'
              }`}
              {...register('firstName', { required: 'Prénom requis' })}
            />
            {errors.firstName && (
              <p className="text-destructive text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>
          
          {/* Last name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Nom</label>
            <input
              type="text"
              placeholder="Entrez le nom"
              className={`w-full px-4 py-3 bg-input border rounded-lg text-foreground ${
                errors.lastName ? 'border-destructive' : 'border-border'
              }`}
              {...register('lastName', { required: 'Nom requis' })}
            />
            {errors.lastName && (
              <p className="text-destructive text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              placeholder="exemple@email.com"
              className={`w-full px-4 py-3 bg-input border rounded-lg text-foreground ${
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
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email.message}</p>
            )}
          </div>
          
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Téléphone</label>
            <input
              type="tel"
              placeholder="+33 6 XX XX XX XX"
              className={`w-full px-4 py-3 bg-input border rounded-lg text-foreground ${
                errors.phone ? 'border-destructive' : 'border-border'
              }`}
              {...register('phone', { required: 'Téléphone requis' })}
            />
            {errors.phone && (
              <p className="text-destructive text-sm mt-1">{errors.phone.message}</p>
            )}
          </div>
          
          {/* Contract type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Type de contrat</label>
            <select
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
              {...register('contractType')}
            >
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Intérim">Intérim</option>
              <option value="Stage">Stage</option>
            </select>
          </div>
          
          {/* Weekly hours */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Heures hebdomadaires</label>
            <input
              type="number"
              min={1}
              max={48}
              className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
              {...register('weeklyHours', { 
                required: true,
                min: 1,
                max: 48,
                valueAsNumber: true
              })}
            />
          </div>
          
          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Couleur planning</label>
            <div className="flex gap-3 flex-wrap">
              {EMPLOYEE_COLORS.map((color) => {
                const isUsed = usedColors.includes(color.value)
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => !isUsed && setSelectedColor(color.value)}
                    disabled={isUsed}
                    className={`size-10 rounded-full border-2 transition-all ${
                      selectedColor === color.value 
                        ? 'border-primary scale-110' 
                        : isUsed
                          ? 'border-transparent opacity-30 cursor-not-allowed'
                          : 'border-transparent hover:border-border'
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {selectedColor === color.value && (
                      <Icon icon="solar:check-circle-bold" className="size-5 text-white mx-auto" />
                    )}
                    {isUsed && selectedColor !== color.value && (
                      <Icon icon="solar:close-circle-bold" className="size-5 text-white/70 mx-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </form>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Icon icon="solar:spinner-bold" className="size-5 animate-spin" />
                {isEditing ? 'Modification...' : 'Ajout...'}
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}