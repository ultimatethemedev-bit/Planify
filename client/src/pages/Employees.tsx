import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import toast from 'react-hot-toast'
import { Header } from '../components/layout/Header'
import { AddEmployeeModal } from '../components/employees/AddEmployeeModal'
import { useEmployeesStore, Employee } from '../stores/employeesStore'
import { employeesApi } from '../services/api'
import { EMPLOYEE_COLORS } from '../utils/planning'

export function Employees() {
  const { employees, setEmployees, deleteEmployee, setLoading, isLoading } = useEmployeesStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  
  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true)
      try {
        const data = await employeesApi.getAll()
        setEmployees(data)
      } catch (error) {
        console.error('Failed to fetch employees:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [])
  
  // Filter employees by search
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
    const query = searchQuery.toLowerCase()
    return fullName.includes(query) || emp.email.toLowerCase().includes(query)
  })
  
  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Supprimer ${employee.firstName} ${employee.lastName} ?`)) return
    
    try {
      await employeesApi.delete(employee._id)
      deleteEmployee(employee._id)
      toast.success('Employé supprimé')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }
  
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setIsModalOpen(true)
  }
  
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingEmployee(null)
  }
  
  const getContractBadgeColor = (color: string) => {
    const colorObj = EMPLOYEE_COLORS.find(c => c.value === color)
    if (!colorObj) return { bg: 'bg-blue-50', text: 'text-blue-700' }
    return { bg: colorObj.bg, text: colorObj.text }
  }
  
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Header 
        rightContent={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
          >
            <Icon icon="solar:user-plus-bold" className="size-5" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        }
      />
      
      {/* Search */}
      <section className="px-6 py-4">
        <div className="relative">
          <Icon
            icon="solar:magnifer-linear"
            className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground shadow-sm"
            placeholder="Rechercher un employé..."
          />
        </div>
      </section>
      
      {/* Employees List */}
      <section className="px-6 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Icon icon="solar:spinner-bold" className="size-8 text-primary animate-spin" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <div className="size-20 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold" className="size-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? 'Aucun résultat' : 'Aucun employé'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Essayez avec d\'autres termes de recherche'
                : 'Ajoutez votre premier employé pour commencer'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
              >
                Ajouter un employé
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees.map((employee) => {
              const badgeColors = getContractBadgeColor(employee.color)
              return (
                <div 
                  key={employee._id} 
                  className="bg-card rounded-xl p-6 shadow-sm border border-border/50"
                >
                  <div className="flex flex-col items-center text-center">
                    <div 
                      className="size-20 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4 shadow-sm"
                      style={{ backgroundColor: employee.color }}
                    >
                      {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-1">{employee.email}</p>
                    <p className="text-sm text-muted-foreground mb-4">{employee.phone}</p>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 ${badgeColors.bg} ${badgeColors.text} rounded-full text-xs font-medium`}>
                        {employee.contractType} {employee.weeklyHours}h
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-5">
                      <div 
                        className="size-3 rounded-full" 
                        style={{ backgroundColor: employee.color }}
                      />
                      <span className="text-xs text-muted-foreground">Couleur planning</span>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full">
                      <button 
                        onClick={() => handleEdit(employee)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                      >
                        <Icon icon="solar:pen-bold" className="size-4" />
                        Modifier
                      </button>
                      <button 
                        onClick={() => handleDelete(employee)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="size-4" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      
      {/* Add/Edit Modal */}
      {isModalOpen && (
        <AddEmployeeModal 
          employee={editingEmployee}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
