import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { timesheetsApi } from '../../services/api'
import { useSettingsStore } from '../../stores/settingsStore'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../utils/errors'

interface Employee {
  _id: string
  firstName: string
  lastName: string
  color: string
  weeklyHours: number
}

interface EmployeeDetailsModalProps {
  employee: Employee
  onClose: () => void
}

interface WeekSummary {
  weekStart: string
  weekEnd: string
  plannedMinutes: number
  actualMinutes: number
  deltaMinutes: number
  cpDays: number
  amDays: number
  notes: Array<{ date: string; note: string; delta?: number }>
  overlapsMonth?: boolean
  daysInMonthCount?: number
}

interface Summary {
  totalPlannedMinutes: number
  totalActualMinutes: number
  totalDeltaMinutes: number
  totalCPDays: number
  totalAMDays: number
  overtime: number
}

export function EmployeeDetailsModal({ employee, onClose }: EmployeeDetailsModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [weeks, setWeeks] = useState<WeekSummary[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const { weekNumberConfig } = useSettingsStore()

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  
  // Fonction pour calculer le numéro de semaine depuis la référence
  const getWeekNumber = (weekStartDate: string): number => {
    // Si pas de config, retourner 1
    if (!weekNumberConfig?.referenceDate) {
      console.log('⚠️ Pas de referenceDate dans weekNumberConfig')
      return 1
    }
    
    try {
      const referenceDate = parseISO(weekNumberConfig.referenceDate)
      const currentWeekStart = parseISO(weekStartDate)
      
      const diffInDays = differenceInDays(currentWeekStart, referenceDate)
      const weekNumber = Math.floor(diffInDays / 7) + (weekNumberConfig.referenceWeekNumber || 1)
      
      console.log('📅 Week calc:', {
        weekStartDate,
        referenceDate: weekNumberConfig.referenceDate,
        diffInDays,
        weekNumber
      })
      
      return weekNumber
    } catch (error) {
      console.error('❌ Erreur calcul semaine:', error)
      return 1
    }
  }

  useEffect(() => {
    fetchTimesheetSummary()
  }, [currentMonth, currentYear])

  const fetchTimesheetSummary = async () => {
    try {
      setIsLoading(true)
      const data = await timesheetsApi.getSummary(employee._id, currentYear, currentMonth)
      setWeeks(data.weeks)
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching timesheet summary:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setIsLoading(false)
    }
  }

  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins.toString().padStart(2, '0')}`
  }

  const handleExportCSV = async () => {
    try {
      // Récupérer les données de tous les mois
      toast.success('Export en cours...')
      
      // Pour l'instant, on exporte juste le mois actuel
      // TODO: Implémenter l'export complet
      const csvContent = generateCSV()
      
      // Créer un blob et télécharger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `historique_${employee.firstName}_${employee.lastName}_${currentYear}-${currentMonth}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Export réussi !')
    } catch (error) {
      toast.error('Erreur lors de l\'export')
    }
  }

  const generateCSV = (): string => {
    let csv = 'Semaine,Prévu (h),Réalisé (h),Delta (h),CP,AM,Notes\n'
    
    weeks.forEach(week => {
      const plannedHours = (week.plannedMinutes / 60).toFixed(1)
      const actualHours = (week.actualMinutes / 60).toFixed(1)
      const deltaHours = (week.deltaMinutes / 60).toFixed(1)
      const notes = week.notes.map(n => `${n.date}: ${n.note}`).join(' | ')
      
      csv += `"${week.weekStart} - ${week.weekEnd}",${plannedHours},${actualHours},${deltaHours},${week.cpDays},${week.amDays},"${notes}"\n`
    })
    
    return csv
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="size-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: employee.color }}
            >
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">
                📊 {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{employee.weeklyHours}h/semaine</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Month selector */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
          <button
            onClick={goToPreviousMonth}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:alt-arrow-left-bold" className="size-5" />
          </button>
          <h3 className="font-semibold text-foreground">
            {monthNames[currentMonth - 1]} {currentYear}
          </h3>
          <button
            onClick={goToNextMonth}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <Icon icon="solar:alt-arrow-right-bold" className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon icon="solar:spinner-bold" className="size-8 animate-spin text-primary" />
            </div>
          ) : weeks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Icon icon="solar:calendar-bold" className="size-12 mb-3 opacity-30" />
              <p>Aucune donnée pour ce mois</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Heures */}
              <div>
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon icon="solar:clock-circle-bold" className="size-5 text-primary" />
                  HEURES
                </h4>
                <div className="space-y-2">
                  {weeks.map((week, index) => {
                    const startDate = parseISO(week.weekStart)
                    const endDate = parseISO(week.weekEnd)
                    const isDeltaPositive = week.deltaMinutes > 0
                    const isDeltaNegative = week.deltaMinutes < 0
                    const weekNumber = getWeekNumber(week.weekStart)
                    
                    return (
                      <div key={index} className="bg-secondary/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm text-foreground">
                            {format(startDate, 'd MMM', { locale: fr })} - {format(endDate, 'd MMM', { locale: fr })} 
                            <span className="text-muted-foreground ml-2">(Semaine {weekNumber})</span>
                          </div>
                        </div>
                        
                        {/* Avertissement si la semaine chevauche 2 mois */}
                        {week.overlapsMonth && (
                          <div className="mb-3 flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                            <Icon icon="solar:info-circle-bold" className="size-4 shrink-0 mt-0.5" />
                            <span>
                              Semaine {format(startDate, 'd MMM', { locale: fr })} - {format(endDate, 'd MMM', { locale: fr })} : 
                              seuls les {week.daysInMonthCount || 0} jour{(week.daysInMonthCount || 0) > 1 ? 's' : ''} de {format(parseISO(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`), 'MMMM', { locale: fr })} sont comptés ici.
                            </span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs mb-1">Prévu</div>
                            <div className="font-semibold">{formatMinutes(week.plannedMinutes)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs mb-1">Réalisé</div>
                            <div className="font-semibold">{formatMinutes(week.actualMinutes)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs mb-1">Delta</div>
                            <div className={`font-semibold ${
                              isDeltaPositive ? 'text-green-600' : 
                              isDeltaNegative ? 'text-red-600' : 
                              'text-foreground'
                            }`}>
                              {isDeltaPositive && '+'}
                              {formatMinutes(week.deltaMinutes)}
                            </div>
                          </div>
                        </div>
                        {week.notes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            {week.notes.map((note, noteIndex) => {
                              const deltaMinutes = note.delta || 0
                              
                              // Formater le delta intelligemment
                              let deltaText = ''
                              if (deltaMinutes !== 0) {
                                const sign = deltaMinutes > 0 ? '+' : ''
                                if (Math.abs(deltaMinutes) >= 60) {
                                  // Afficher en heures si >= 1h
                                  deltaText = `${sign}${formatMinutes(Math.abs(deltaMinutes))}`
                                } else {
                                  // Afficher en minutes si < 1h
                                  deltaText = `${sign}${deltaMinutes}min`
                                }
                              }
                              
                              return (
                                <div key={noteIndex} className="text-xs flex items-start gap-2 mb-1">
                                  <Icon icon="solar:notes-bold" className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
                                  <div className="flex-1">
                                    <span className="font-medium text-foreground">
                                      {format(parseISO(note.date), 'd MMM', { locale: fr })}:
                                    </span>
                                    {note.note && (
                                      <span className="text-muted-foreground ml-1">{note.note}</span>
                                    )}
                                    {deltaText && (
                                      <span className={`ml-2 font-semibold ${
                                        deltaMinutes > 0 ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        ({deltaText})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* Total du mois */}
                {summary && (
                  <div className="mt-4 bg-primary/10 rounded-lg p-4 border border-primary/20">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Total prévu</div>
                        <div className="font-bold text-foreground">{formatMinutes(summary.totalPlannedMinutes)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Total réalisé</div>
                        <div className="font-bold text-foreground">{formatMinutes(summary.totalActualMinutes)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Delta total</div>
                        <div className={`font-bold ${
                          summary.totalDeltaMinutes > 0 ? 'text-green-600' : 
                          summary.totalDeltaMinutes < 0 ? 'text-red-600' : 
                          'text-foreground'
                        }`}>
                          {summary.totalDeltaMinutes > 0 && '+'}
                          {formatMinutes(summary.totalDeltaMinutes)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Congés payés */}
              {summary && summary.totalCPDays > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon icon="solar:calendar-mark-bold" className="size-5 text-orange-500" />
                    CONGÉS PAYÉS
                  </h4>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-700">Total CP ce mois</span>
                      <span className="font-bold text-orange-700">{summary.totalCPDays} jour(s)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Arrêts maladie */}
              {summary && summary.totalAMDays > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Icon icon="solar:health-bold" className="size-5 text-red-500" />
                    ARRÊTS MALADIE
                  </h4>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700">Total AM ce mois</span>
                      <span className="font-bold text-red-700">{summary.totalAMDays} jour(s)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex gap-3 flex-shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={weeks.length === 0}
            className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Icon icon="solar:download-bold" className="size-5" />
            Télécharger historique
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}