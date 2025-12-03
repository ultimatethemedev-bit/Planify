import express from 'express'
import Timesheet from '../models/Timesheet.js'
import Planning from '../models/Planning.js'
import Employee from '../models/Employee.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Helper: calculer les minutes d'un shift
const calculateMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return 0
  if (startTime === 'CP' || startTime === 'AM' || startTime === '00:00' && endTime === '00:00') return 0
  
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  
  let startMinutes = startH * 60 + startM
  let endMinutes = endH * 60 + endM
  
  // Gestion passage minuit
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }
  
  return endMinutes - startMinutes
}

// Helper: déterminer le type de jour
const getDayType = (startTime, endTime) => {
  if (startTime === 'CP' && endTime === 'CP') return 'cp'
  if (startTime === 'AM' && endTime === 'AM') return 'am'
  if (startTime === '00:00' && endTime === '00:00') return 'rest'
  return 'work'
}

// POST /timesheets/validate - Valider le planning et créer les timesheets
router.post('/validate', async (req, res) => {
  try {
    const { weekStart } = req.body
    
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    // Récupérer le planning de la semaine
    const planning = await Planning.findOne({
      userId: req.userId,
      storeId: req.user.currentStoreId,
      weekStart,
    })
    
    if (!planning) {
      return res.status(404).json({ message: 'Planning non trouvé' })
    }
    
    if (planning.isValidated) {
      return res.status(400).json({ message: 'Planning déjà validé' })
    }
    
    // Récupérer tous les employés actifs
    const employees = await Employee.find({
      userId: req.userId,
      storeId: req.user.currentStoreId,
      isActive: true,
    })
    
    // Générer les dates de la semaine
    const weekDates = []
    const startDate = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      weekDates.push(date.toISOString().split('T')[0])
    }
    
    // Créer un timesheet pour chaque employé
    const timesheets = []
    
    for (const employee of employees) {
      // Récupérer les shifts de cet employé pour cette semaine
      const employeeShifts = planning.shifts.filter(
        s => s.employeeId.toString() === employee._id.toString()
      )
      
      // Créer les entrées par jour
      const days = weekDates.map(date => {
        const shift = employeeShifts.find(s => s.date === date)
        
        if (shift) {
          const type = getDayType(shift.startTime, shift.endTime)
          const minutes = calculateMinutes(shift.startTime, shift.endTime)
          
          return {
            date,
            type,
            plannedStart: type === 'work' ? shift.startTime : null,
            plannedEnd: type === 'work' ? shift.endTime : null,
            plannedMinutes: minutes,
            actualStart: type === 'work' ? shift.startTime : null,
            actualEnd: type === 'work' ? shift.endTime : null,
            actualMinutes: minutes,
            deltaMinutes: 0,
            note: '',
            modifications: [],
          }
        }
        
        // Pas de shift = repos
        return {
          date,
          type: 'rest',
          plannedStart: null,
          plannedEnd: null,
          plannedMinutes: 0,
          actualStart: null,
          actualEnd: null,
          actualMinutes: 0,
          deltaMinutes: 0,
          note: '',
          modifications: [],
        }
      })
      
      // Calculer les totaux
      let totalPlanned = 0
      let totalActual = 0
      days.forEach(day => {
        if (day.type === 'work') {
          totalPlanned += day.plannedMinutes
          totalActual += day.actualMinutes
        }
      })
      
      // Créer ou mettre à jour le timesheet
      const timesheet = await Timesheet.findOneAndUpdate(
        {
          userId: req.userId,
          storeId: req.user.currentStoreId,
          employeeId: employee._id,
          weekStart,
        },
        {
          userId: req.userId,
          storeId: req.user.currentStoreId,
          employeeId: employee._id,
          weekStart,
          weekEnd: planning.weekEnd,
          days,
          totalPlannedMinutes: totalPlanned,
          totalActualMinutes: totalActual,
          totalDeltaMinutes: 0,
        },
        { upsert: true, new: true }
      )
      
      timesheets.push(timesheet)
    }
    
    // Marquer le planning comme validé
    planning.isValidated = true
    planning.validatedAt = new Date()
    await planning.save()
    
    res.json({
      message: 'Planning validé',
      planning,
      timesheets,
    })
  } catch (error) {
    console.error('Validate planning error:', error)
    res.status(500).json({ message: 'Erreur lors de la validation' })
  }
})

// GET /timesheets - Récupérer les timesheets d'une semaine
router.get('/', async (req, res) => {
  try {
    const { weekStart } = req.query
    
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    const timesheets = await Timesheet.find({
      userId: req.userId,
      storeId: req.user.currentStoreId,
      weekStart,
    })
    
    res.json(timesheets)
  } catch (error) {
    console.error('Get timesheets error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération' })
  }
})

// GET /timesheets/employee/:employeeId - Récupérer les timesheets d'un employé (pour historique)
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params
    const { month, year } = req.query
    
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    // Construire la requête
    const query = {
      userId: req.userId,
      storeId: req.user.currentStoreId,
      employeeId,
    }
    
    // Si mois/année spécifiés, filtrer
    if (month && year) {
      const startOfMonth = `${year}-${month.padStart(2, '0')}-01`
      const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]
      query.weekStart = { $gte: startOfMonth, $lte: endOfMonth }
    }
    
    const timesheets = await Timesheet.find(query).sort({ weekStart: -1 })
    
    res.json(timesheets)
  } catch (error) {
    console.error('Get employee timesheets error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération' })
  }
})

// PUT /timesheets/:employeeId/day - Mettre à jour les heures réalisées d'un jour
router.put('/:employeeId/day', async (req, res) => {
  try {
    const { employeeId } = req.params
    const { weekStart, date, actualStart, actualEnd, note, type } = req.body
    
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    const timesheet = await Timesheet.findOne({
      userId: req.userId,
      storeId: req.user.currentStoreId,
      employeeId,
      weekStart,
    })
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet non trouvé' })
    }
    
    // Trouver le jour à modifier
    const dayIndex = timesheet.days.findIndex(d => d.date === date)
    if (dayIndex === -1) {
      return res.status(404).json({ message: 'Jour non trouvé' })
    }
    
    const day = timesheet.days[dayIndex]
    
    // Enregistrer les modifications dans l'historique
    const modifications = []
    
    if (type && type !== day.type) {
      modifications.push({
        changedAt: new Date(),
        field: 'type',
        from: day.type,
        to: type,
      })
      day.type = type
    }
    
    if (actualStart !== undefined && actualStart !== day.actualStart) {
      modifications.push({
        changedAt: new Date(),
        field: 'actualStart',
        from: day.actualStart,
        to: actualStart,
      })
      day.actualStart = actualStart
    }
    
    if (actualEnd !== undefined && actualEnd !== day.actualEnd) {
      modifications.push({
        changedAt: new Date(),
        field: 'actualEnd',
        from: day.actualEnd,
        to: actualEnd,
      })
      day.actualEnd = actualEnd
    }
    
    if (note !== undefined) {
      if (note !== day.note) {
        modifications.push({
          changedAt: new Date(),
          field: 'note',
          from: day.note,
          to: note,
        })
      }
      day.note = note
    }
    
    // Ajouter les modifications à l'historique
    if (modifications.length > 0) {
      day.modifications = [...(day.modifications || []), ...modifications]
    }
    
    // Recalculer les minutes si c'est du travail
    if (day.type === 'work') {
      day.actualMinutes = calculateMinutes(day.actualStart, day.actualEnd)
      day.deltaMinutes = day.actualMinutes - day.plannedMinutes
    } else {
      day.actualMinutes = 0
      day.deltaMinutes = -day.plannedMinutes
    }
    
    // Sauvegarder le jour modifié
    timesheet.days[dayIndex] = day
    
    // Recalculer les totaux
    timesheet.recalculateTotals()
    
    await timesheet.save()
    
    res.json(timesheet)
  } catch (error) {
    console.error('Update timesheet day error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour' })
  }
})

// GET /timesheets/summary/:employeeId - Récap mensuel pour un employé
router.get('/summary/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params
    const { year, month } = req.query
    
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    // Par défaut, mois en cours
    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)
    
    // Récupérer l'employé
    const employee = await Employee.findById(employeeId)
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }
    
    // Récupérer les timesheets du mois
    const startOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const lastDay = new Date(targetYear, targetMonth, 0).getDate()
    const endOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`
    
    const timesheets = await Timesheet.find({
      userId: req.userId,
      storeId: req.user.currentStoreId,
      employeeId,
      weekStart: { $lte: endOfMonth },
      weekEnd: { $gte: startOfMonth },
    }).sort({ weekStart: 1 })
    
    // Calculer les totaux du mois
    let totalPlanned = 0
    let totalActual = 0
    let totalCP = 0
    let totalAM = 0
    
    const weeklySummaries = timesheets.map(ts => {
      // Filtrer les jours qui sont dans le mois (ancienne logique = correcte pour la paie)
      const daysInMonth = ts.days.filter(d => {
        return d.date >= startOfMonth && d.date <= endOfMonth
      })
      
      // Vérifier si la semaine chevauche le mois (pour afficher l'info)
      const allDays = ts.days
      const hasOverlap = allDays.some(d => d.date < startOfMonth || d.date > endOfMonth)
      
      // Compter combien de jours sont dans le mois
      const daysInMonthCount = daysInMonth.length
      
      let weekPlanned = 0
      let weekActual = 0
      let weekCP = 0
      let weekAM = 0
      const notes = []
      
      daysInMonth.forEach(day => {
        if (day.type === 'work') {
          weekPlanned += day.plannedMinutes
          weekActual += day.actualMinutes
        } else if (day.type === 'cp') {
          weekCP++
        } else if (day.type === 'am') {
          weekAM++
        }
        
        // Ajouter le jour si :
        // 1. Il y a une note OU
        // 2. Il y a un delta (heures modifiées) ET des heures réalisées ont été saisies
        const dayDelta = day.actualMinutes - day.plannedMinutes
        const hasActualHours = day.actualStart && day.actualEnd
        
        if (day.note || (dayDelta !== 0 && hasActualHours)) {
          notes.push({ 
            date: day.date, 
            note: day.note || '', 
            delta: dayDelta 
          })
        }
      })
      
      totalPlanned += weekPlanned
      totalActual += weekActual
      totalCP += weekCP
      totalAM += weekAM
      
      return {
        weekStart: ts.weekStart,
        weekEnd: ts.weekEnd,
        plannedMinutes: weekPlanned,
        actualMinutes: weekActual,
        deltaMinutes: weekActual - weekPlanned,
        cpDays: weekCP,
        amDays: weekAM,
        notes,
        overlapsMonth: hasOverlap, // Indique si la semaine chevauche
        daysInMonthCount, // Nombre de jours dans le mois
      }
    })
    
    // Delta total
    const totalDelta = totalActual - totalPlanned
    const contractMinutes = employee.weeklyHours * 60 * 4 // ~4 semaines
    
    res.json({
      employee: {
        _id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        weeklyHours: employee.weeklyHours,
      },
      year: targetYear,
      month: targetMonth,
      summary: {
        totalPlannedMinutes: totalPlanned,
        totalActualMinutes: totalActual,
        totalDeltaMinutes: totalDelta,
        totalCPDays: totalCP,
        totalAMDays: totalAM,
        // Heures supp = au-delà du contrat mensuel
        overtime: Math.max(0, totalActual - contractMinutes),
      },
      weeks: weeklySummaries,
    })
  } catch (error) {
    console.error('Get timesheet summary error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération du résumé' })
  }
})

export default router