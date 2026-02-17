import express from 'express'
import Planning from '../models/Planning.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Helper to calculate weekEnd from weekStart
const getWeekEnd = (weekStart) => {
  const date = new Date(weekStart)
  date.setDate(date.getDate() + 6)
  return date.toISOString().split('T')[0]
}

// Get planning for a week
router.get('/', async (req, res) => {
  try {
    const { weekStart } = req.query

    if (!weekStart) {
      return res.status(400).json({ message: 'weekStart parameter required' })
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
      planning = {
        weekStart,
        weekEnd: getWeekEnd(weekStart),
        shifts: [],
      }
    }

    res.json(planning)
  } catch (error) {
    console.error('Get planning error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération du planning' })
  }
})

// Create or update planning
router.post('/', async (req, res) => {
  try {
    const { weekStart, shifts } = req.body

    if (!weekStart) {
      return res.status(400).json({ message: 'weekStart required' })
    }

    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const weekEnd = getWeekEnd(weekStart)

    // Upsert planning
    const planning = await Planning.findOneAndUpdate(
      { storeId: req.storeId, weekStart },
      {
        $set: {
          weekEnd,
          shifts: shifts || [],
        }
      },
      { new: true, upsert: true, runValidators: true }
    )

    res.json(planning)
  } catch (error) {
    console.error('Create/update planning error:', error)
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du planning' })
  }
})

// Duplicate planning from one week to another
router.post('/duplicate', async (req, res) => {
  try {
    const { sourceWeekStart, targetWeekStart } = req.body

    if (!sourceWeekStart || !targetWeekStart) {
      return res.status(400).json({ message: 'sourceWeekStart and targetWeekStart required' })
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
    const daysDiff = Math.round((targetDate - sourceDate) / (1000 * 60 * 60 * 24))

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
    console.error('Duplicate planning error:', error)
    res.status(500).json({ message: 'Erreur lors de la duplication du planning' })
  }
})

// Delete planning
router.delete('/', async (req, res) => {
  try {
    const { weekStart } = req.query

    if (!weekStart) {
      return res.status(400).json({ message: 'weekStart parameter required' })
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
    console.error('Delete planning error:', error)
    res.status(500).json({ message: 'Erreur lors de la suppression du planning' })
  }
})

export default router
