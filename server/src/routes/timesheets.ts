import express, { Request, Response } from 'express'
import Timesheet, { IDayEntry } from '../models/Timesheet.js'
import Planning from '../models/Planning.js'
import Employee from '../models/Employee.js'
import { auth, validateObjectIds } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// Validation helper
const isValidDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v)

// All routes require authentication
router.use(auth)

// Helper: calculer les minutes d'un shift
const calculateMinutes = (startTime: string | null | undefined, endTime: string | null | undefined): number => {
  if (!startTime || !endTime) return 0
  if (startTime === 'CP' || startTime === 'AM' || (startTime === '00:00' && endTime === '00:00')) return 0

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
const getDayType = (startTime: string, endTime: string): IDayEntry['type'] => {
  if (startTime === 'CP' && endTime === 'CP') return 'cp'
  if (startTime === 'AM' && endTime === 'AM') return 'am'
  if (startTime === '00:00' && endTime === '00:00') return 'rest'
  return 'work'
}

/**
 * @swagger
 * /timesheets/validate:
 *   post:
 *     summary: Validate a planning and create timesheets for all active employees
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weekStart
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 example: "2026-02-17"
 *                 description: Start date of the week to validate (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Planning validated and timesheets created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Planning validé"
 *                 planning:
 *                   $ref: '#/components/schemas/Planning'
 *                 timesheets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: Invalid weekStart, no store selected, or planning already validated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Planning not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /timesheets/validate - Valider le planning et créer les timesheets
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.body

    if (!weekStart || !isValidDate(weekStart)) {
      return res.status(400).json({ message: 'weekStart invalide (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    // Atomically mark as validated (prevents race conditions)
    const planning = await Planning.findOneAndUpdate(
      { storeId: req.storeId, weekStart, isValidated: { $ne: true } },
      { $set: { isValidated: true, validatedAt: new Date() } },
      { new: true }
    )

    if (!planning) {
      // Check if it exists but is already validated
      const existing = await Planning.findOne({ storeId: req.storeId, weekStart })
      if (existing?.isValidated) {
        return res.status(400).json({ message: 'Planning déjà validé' })
      }
      return res.status(404).json({ message: 'Planning non trouvé' })
    }

    // Récupérer tous les employés actifs
    const employees = await Employee.find({
      storeId: req.storeId,
      isActive: true,
    })

    // Générer les dates de la semaine
    const weekDates: string[] = []
    const startDate = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      weekDates.push(date.toISOString().split('T')[0])
    }

    // Créer un timesheet pour chaque employé
    const timesheets = []

    for (const employee of employees) {
      const employeeShifts = planning.shifts.filter(
        s => s.employeeId.toString() === employee._id.toString()
      )

      const days: IDayEntry[] = weekDates.map(date => {
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

        return {
          date,
          type: 'rest' as const,
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

      let totalPlanned = 0
      let totalActual = 0
      days.forEach(day => {
        if (day.type === 'work') {
          totalPlanned += day.plannedMinutes
          totalActual += day.actualMinutes
        }
      })

      const timesheet = await Timesheet.findOneAndUpdate(
        {
          storeId: req.storeId,
          employeeId: employee._id,
          weekStart,
        },
        {
          storeId: req.storeId,
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

    res.json({
      message: 'Planning validé',
      planning,
      timesheets,
    })
  } catch (error) {
    logger.error({ err: error }, 'Validate planning error')
    res.status(500).json({ message: 'Erreur lors de la validation' })
  }
})

/**
 * @swagger
 * /timesheets/unvalidate:
 *   post:
 *     summary: Unvalidate a planning and delete all associated timesheets
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weekStart
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 example: "2026-02-17"
 *                 description: Start date of the week to unvalidate (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Planning unvalidated and timesheets deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Planning dévalidé"
 *                 planning:
 *                   $ref: '#/components/schemas/Planning'
 *                 hadModifications:
 *                   type: boolean
 *                   description: Whether any timesheet days had manual modifications before deletion
 *                 modificationsCount:
 *                   type: integer
 *                   description: Total number of days with modifications
 *       400:
 *         description: Invalid weekStart, no store selected, or planning not validated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Planning not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /timesheets/unvalidate - Dévalider le planning et supprimer les timesheets
router.post('/unvalidate', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.body

    if (!weekStart || !isValidDate(weekStart)) {
      return res.status(400).json({ message: 'weekStart invalide (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const planning = await Planning.findOne({
      storeId: req.storeId,
      weekStart,
    })

    if (!planning) {
      return res.status(404).json({ message: 'Planning non trouvé' })
    }

    if (!planning.isValidated) {
      return res.status(400).json({ message: 'Planning non validé' })
    }

    const timesheets = await Timesheet.find({
      storeId: req.storeId,
      weekStart,
    })

    let hasModifications = false
    let modificationsCount = 0

    for (const timesheet of timesheets) {
      for (const day of timesheet.days) {
        if (day.type === 'work') {
          if (day.actualStart !== day.plannedStart || day.actualEnd !== day.plannedEnd) {
            hasModifications = true
            modificationsCount++
          }
        }
        if (day.note && day.note.trim() !== '') {
          hasModifications = true
          modificationsCount++
        }
        if (day.modifications && day.modifications.length > 0) {
          hasModifications = true
        }
      }
    }

    await Timesheet.deleteMany({
      storeId: req.storeId,
      weekStart,
    })

    planning.isValidated = false
    planning.validatedAt = null
    await planning.save()

    res.json({
      message: 'Planning dévalidé',
      planning,
      hadModifications: hasModifications,
      modificationsCount,
    })
  } catch (error) {
    logger.error({ err: error }, 'Unvalidate planning error')
    res.status(500).json({ message: 'Erreur lors de la dévalidation' })
  }
})

/**
 * @swagger
 * /timesheets:
 *   get:
 *     summary: Get all timesheets for a given week
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-02-17"
 *         description: Start date of the week (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of timesheets for the specified week
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: No store selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /timesheets - Récupérer les timesheets d'une semaine
router.get('/', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.query

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const timesheets = await Timesheet.find({
      storeId: req.storeId,
      weekStart,
    })

    res.json(timesheets)
  } catch (error) {
    logger.error({ err: error }, 'Get timesheets error')
    res.status(500).json({ message: 'Erreur lors de la récupération' })
  }
})

/**
 * @swagger
 * /timesheets/employee/{employeeId}:
 *   get:
 *     summary: Get timesheets for a specific employee, optionally filtered by month and year
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the employee
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 2
 *         description: Month number (1-12). Must be combined with year.
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           example: 2026
 *         description: Four-digit year. Must be combined with month.
 *     responses:
 *       200:
 *         description: List of timesheets for the employee, sorted by weekStart descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: No store selected or invalid employeeId format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /timesheets/employee/:employeeId - Récupérer les timesheets d'un employé
router.get('/employee/:employeeId', validateObjectIds('employeeId'), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params
    const { month, year } = req.query

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const query: Record<string, unknown> = {
      storeId: req.storeId,
      employeeId,
    }

    if (month && year) {
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
      const endOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]
      query.weekStart = { $gte: startOfMonth, $lte: endOfMonth }
    }

    const timesheets = await Timesheet.find(query).sort({ weekStart: -1 })

    res.json(timesheets)
  } catch (error) {
    logger.error({ err: error }, 'Get employee timesheets error')
    res.status(500).json({ message: 'Erreur lors de la récupération' })
  }
})

/**
 * @swagger
 * /timesheets/{employeeId}/day:
 *   put:
 *     summary: Update actual hours and details for a specific day in an employee's timesheet
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the employee
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weekStart
 *               - date
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *                 example: "2026-02-17"
 *                 description: Start date of the week (YYYY-MM-DD)
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-02-19"
 *                 description: The specific day to update (YYYY-MM-DD)
 *               actualStart:
 *                 type: string
 *                 example: "09:00"
 *                 description: Actual start time (HH:MM), null to clear
 *               actualEnd:
 *                 type: string
 *                 example: "17:30"
 *                 description: Actual end time (HH:MM), null to clear
 *               note:
 *                 type: string
 *                 example: "Left early - doctor appointment"
 *                 description: Optional note for the day
 *               type:
 *                 type: string
 *                 enum: [work, cp, am, rest]
 *                 description: Override the day type
 *     responses:
 *       200:
 *         description: Updated timesheet document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Timesheet'
 *       400:
 *         description: No store selected or invalid employeeId format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Timesheet or day not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PUT /timesheets/:employeeId/day - Mettre à jour les heures réalisées d'un jour
router.put('/:employeeId/day', validateObjectIds('employeeId'), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params
    const { weekStart, date, actualStart, actualEnd, note, type } = req.body

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const timesheet = await Timesheet.findOne({
      storeId: req.storeId,
      employeeId,
      weekStart,
    })

    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet non trouvé' })
    }

    const dayIndex = timesheet.days.findIndex(d => d.date === date)
    if (dayIndex === -1) {
      return res.status(404).json({ message: 'Jour non trouvé' })
    }

    const day = timesheet.days[dayIndex]

    const modifications: Array<{ changedAt: Date; field: string; from?: string; to?: string }> = []

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
        from: day.actualStart ?? undefined,
        to: actualStart,
      })
      day.actualStart = actualStart
    }

    if (actualEnd !== undefined && actualEnd !== day.actualEnd) {
      modifications.push({
        changedAt: new Date(),
        field: 'actualEnd',
        from: day.actualEnd ?? undefined,
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

    if (modifications.length > 0) {
      day.modifications = [...(day.modifications || []), ...modifications]
    }

    if (day.type === 'work') {
      day.actualMinutes = calculateMinutes(day.actualStart, day.actualEnd)
      day.deltaMinutes = day.actualMinutes - day.plannedMinutes
    } else {
      day.actualMinutes = 0
      day.deltaMinutes = -day.plannedMinutes
    }

    timesheet.days[dayIndex] = day

    timesheet.recalculateTotals()

    await timesheet.save()

    res.json(timesheet)
  } catch (error) {
    logger.error({ err: error }, 'Update timesheet day error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour' })
  }
})

/**
 * @swagger
 * /timesheets/summary/{employeeId}:
 *   get:
 *     summary: Get a monthly summary of timesheets for a specific employee
 *     tags: [Timesheets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the employee
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           example: 2026
 *         description: Four-digit year (defaults to current year)
 *       - in: query
 *         name: month
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 2
 *         description: Month number 1-12 (defaults to current month)
 *     responses:
 *       200:
 *         description: Monthly summary including employee info, totals and per-week breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 employee:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     weeklyHours:
 *                       type: number
 *                 year:
 *                   type: integer
 *                 month:
 *                   type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalPlannedMinutes:
 *                       type: integer
 *                     totalActualMinutes:
 *                       type: integer
 *                     totalDeltaMinutes:
 *                       type: integer
 *                     totalCPDays:
 *                       type: integer
 *                     totalAMDays:
 *                       type: integer
 *                     overtime:
 *                       type: integer
 *                       description: Minutes exceeding the monthly contract hours (min 0)
 *                 weeks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       weekStart:
 *                         type: string
 *                         format: date
 *                       weekEnd:
 *                         type: string
 *                         format: date
 *                       plannedMinutes:
 *                         type: integer
 *                       actualMinutes:
 *                         type: integer
 *                       deltaMinutes:
 *                         type: integer
 *                       cpDays:
 *                         type: integer
 *                       amDays:
 *                         type: integer
 *                       notes:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             date:
 *                               type: string
 *                               format: date
 *                             note:
 *                               type: string
 *                             delta:
 *                               type: integer
 *                       overlapsMonth:
 *                         type: boolean
 *                       daysInMonthCount:
 *                         type: integer
 *       400:
 *         description: No store selected or invalid employeeId format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Employee not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /timesheets/summary/:employeeId - Récap mensuel pour un employé
router.get('/summary/:employeeId', validateObjectIds('employeeId'), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params
    const { year, month } = req.query

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const targetYear = year || new Date().getFullYear()
    const targetMonth = month || (new Date().getMonth() + 1)

    const employee = await Employee.findById(employeeId)
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }

    const startOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const lastDay = new Date(Number(targetYear), Number(targetMonth), 0).getDate()
    const endOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`

    const timesheets = await Timesheet.find({
      storeId: req.storeId,
      employeeId,
      weekStart: { $lte: endOfMonth },
      weekEnd: { $gte: startOfMonth },
    }).sort({ weekStart: 1 })

    let totalPlanned = 0
    let totalActual = 0
    let totalCP = 0
    let totalAM = 0

    const weeklySummaries = timesheets.map(ts => {
      const daysInMonth = ts.days.filter(d => {
        return d.date >= startOfMonth && d.date <= endOfMonth
      })

      const allDays = ts.days
      const hasOverlap = allDays.some(d => d.date < startOfMonth || d.date > endOfMonth)
      const daysInMonthCount = daysInMonth.length

      let weekPlanned = 0
      let weekActual = 0
      let weekCP = 0
      let weekAM = 0
      const notes: Array<{ date: string; note: string; delta: number }> = []

      daysInMonth.forEach(day => {
        if (day.type === 'work') {
          weekPlanned += day.plannedMinutes
          weekActual += day.actualMinutes
        } else if (day.type === 'cp') {
          weekCP++
        } else if (day.type === 'am') {
          weekAM++
        }

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
        overlapsMonth: hasOverlap,
        daysInMonthCount,
      }
    })

    const totalDelta = totalActual - totalPlanned
    const contractMinutes = employee.weeklyHours * 60 * 4

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
        overtime: Math.max(0, totalActual - contractMinutes),
      },
      weeks: weeklySummaries,
    })
  } catch (error) {
    logger.error({ err: error }, 'Get timesheet summary error')
    res.status(500).json({ message: 'Erreur lors de la récupération du résumé' })
  }
})

export default router
