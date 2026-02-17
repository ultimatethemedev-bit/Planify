import express, { Request, Response } from 'express'
import Planning from '../models/Planning.js'
import { auth, validateObjectIds } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

// Validation helpers
const isValidDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v)
const isValidTime = (v: string): boolean =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(v) || v === 'CP' || v === 'AM' || v === '00:00'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Helper to calculate weekEnd from weekStart
const getWeekEnd = (weekStart: string): string => {
  const date = new Date(weekStart)
  date.setDate(date.getDate() + 6)
  return date.toISOString().split('T')[0]
}

/**
 * @swagger
 * /planning:
 *   get:
 *     summary: Get planning for a week
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *         description: Start date of the week (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Planning for the requested week
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Planning'
 *       400:
 *         description: Invalid weekStart parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
// Get planning for a week
router.get('/', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.query as { weekStart?: string }

    if (!weekStart || !isValidDate(weekStart)) {
      return res.status(400).json({ message: 'weekStart invalide (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.json({
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        shifts: [],
      })
    }

    let planning = await Planning.findOne({
      storeId: req.storeId,
      weekStart,
    })

    // If no planning exists, return empty structure
    if (!planning) {
      res.json({
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        shifts: [],
      })
      return
    }

    res.json(planning)
  } catch (error) {
    logger.error({ err: error }, 'Get planning error')
    res.status(500).json({ message: 'Erreur lors de la récupération du planning' })
  }
})

/**
 * @swagger
 * /planning:
 *   post:
 *     summary: Create or update planning for a week
 *     tags: [Planning]
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
 *                 description: Start date of the week (YYYY-MM-DD)
 *               shifts:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Shift'
 *     responses:
 *       200:
 *         description: Created or updated planning
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Planning'
 *       400:
 *         description: Invalid input or no store selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
// Create or update planning
router.post('/', async (req: Request, res: Response) => {
  try {
    const { weekStart, shifts } = req.body as {
      weekStart?: string
      shifts?: Array<{
        employeeId: string
        date: string
        startTime: string
        endTime: string
      }>
    }

    if (!weekStart || !isValidDate(weekStart)) {
      return res.status(400).json({ message: 'weekStart invalide (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const weekEnd = getWeekEnd(weekStart)

    // Sanitize & validate shifts
    const sanitizedShifts = (shifts || []).map(s => ({
      employeeId: s.employeeId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    }))

    // Upsert planning
    const planning = await Planning.findOneAndUpdate(
      { storeId: req.storeId, weekStart },
      {
        $set: {
          weekEnd,
          shifts: sanitizedShifts,
        }
      },
      { new: true, upsert: true, runValidators: true }
    )

    res.json(planning)
  } catch (error) {
    logger.error({ err: error }, 'Create/update planning error')
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du planning' })
  }
})

/**
 * @swagger
 * /planning/duplicate:
 *   post:
 *     summary: Duplicate planning from one week to another
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceWeekStart
 *               - targetWeekStart
 *             properties:
 *               sourceWeekStart:
 *                 type: string
 *                 description: Start date of the source week to copy from (YYYY-MM-DD)
 *               targetWeekStart:
 *                 type: string
 *                 description: Start date of the target week to copy to (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Newly created planning for the target week
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Planning'
 *       400:
 *         description: Invalid dates or no store selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Source planning not found
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
// Duplicate planning from one week to another
router.post('/duplicate', async (req: Request, res: Response) => {
  try {
    const { sourceWeekStart, targetWeekStart } = req.body as {
      sourceWeekStart?: string
      targetWeekStart?: string
    }

    if (!sourceWeekStart || !isValidDate(sourceWeekStart) || !targetWeekStart || !isValidDate(targetWeekStart)) {
      return res.status(400).json({ message: 'Dates invalides (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    // Get source planning
    const sourcePlanning = await Planning.findOne({
      storeId: req.storeId,
      weekStart: sourceWeekStart,
    })

    if (!sourcePlanning) {
      return res.status(404).json({ message: 'Planning source non trouvé' })
    }

    // Calculate date difference
    const sourceDate = new Date(sourceWeekStart)
    const targetDate = new Date(targetWeekStart)
    const daysDiff = Math.round((targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24))

    // Adjust shifts dates
    const newShifts = sourcePlanning.shifts.map(shift => {
      const shiftDate = new Date(shift.date)
      shiftDate.setDate(shiftDate.getDate() + daysDiff)
      return {
        employeeId: shift.employeeId,
        date: shiftDate.toISOString().split('T')[0],
        startTime: shift.startTime,
        endTime: shift.endTime,
      }
    })

    // Create or update target planning
    const targetPlanning = await Planning.findOneAndUpdate(
      { storeId: req.storeId, weekStart: targetWeekStart },
      {
        $set: {
          weekEnd: getWeekEnd(targetWeekStart),
          shifts: newShifts,
        }
      },
      { new: true, upsert: true, runValidators: true }
    )

    res.json(targetPlanning)
  } catch (error) {
    logger.error({ err: error }, 'Duplicate planning error')
    res.status(500).json({ message: 'Erreur lors de la duplication du planning' })
  }
})

/**
 * @swagger
 * /planning:
 *   delete:
 *     summary: Delete planning for a week
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *         description: Start date of the week to delete (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Planning deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Invalid weekStart parameter or no store selected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
// Delete planning
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { weekStart } = req.query as { weekStart?: string }

    if (!weekStart || !isValidDate(weekStart)) {
      return res.status(400).json({ message: 'weekStart invalide (format YYYY-MM-DD requis)' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    await Planning.findOneAndDelete({
      storeId: req.storeId,
      weekStart,
    })

    res.json({ message: 'Planning supprimé' })
  } catch (error) {
    logger.error({ err: error }, 'Delete planning error')
    res.status(500).json({ message: 'Erreur lors de la suppression du planning' })
  }
})

export default router
