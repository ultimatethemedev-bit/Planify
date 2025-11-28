import express from 'express'
import { body, validationResult } from 'express-validator'
import Settings from '../models/Settings.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Helper to get or create settings
const getOrCreateSettings = async (userId) => {
  let settings = await Settings.findOne({ userId })
  if (!settings) {
    settings = await Settings.create({ userId })
  }
  return settings
}

// Get store hours
router.get('/store-hours', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.userId)
    res.json(settings.storeHours)
  } catch (error) {
    console.error('Get store hours error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération des horaires' })
  }
})

// Update store hours
router.put('/store-hours', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { storeHours: req.body } },
      { new: true, upsert: true }
    )
    res.json(settings.storeHours)
  } catch (error) {
    console.error('Update store hours error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour des horaires' })
  }
})

// Get all events
router.get('/events', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.userId)
    res.json(settings.events)
  } catch (error) {
    console.error('Get events error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération des événements' })
  }
})

// Create event
router.post('/events', [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('startDate').notEmpty().withMessage('Date de début requise'),
  body('endDate').notEmpty().withMessage('Date de fin requise'),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg })
    }
    
    const settings = await getOrCreateSettings(req.userId)
    
    const newEvent = {
      name: req.body.name,
      emoji: req.body.emoji || '🔥',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      color: req.body.color || '#F97316',
    }
    
    settings.events.push(newEvent)
    await settings.save()
    
    // Return the newly created event
    const createdEvent = settings.events[settings.events.length - 1]
    res.status(201).json(createdEvent)
  } catch (error) {
    console.error('Create event error:', error)
    res.status(500).json({ message: 'Erreur lors de la création de l\'événement' })
  }
})

// Update event
router.put('/events/:id', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.userId)
    
    const eventIndex = settings.events.findIndex(
      e => e._id.toString() === req.params.id
    )
    
    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Événement non trouvé' })
    }
    
    // Update event fields
    Object.assign(settings.events[eventIndex], req.body)
    await settings.save()
    
    res.json(settings.events[eventIndex])
  } catch (error) {
    console.error('Update event error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'événement' })
  }
})

// Delete event
router.delete('/events/:id', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $pull: { events: { _id: req.params.id } } },
      { new: true }
    )
    
    if (!settings) {
      return res.status(404).json({ message: 'Événement non trouvé' })
    }
    
    res.json({ message: 'Événement supprimé' })
  } catch (error) {
    console.error('Delete event error:', error)
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'événement' })
  }
})

// Get shift templates
router.get('/shift-templates', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.userId)
    res.json(settings.shiftTemplates || [
      { name: 'Matin', startTime: '10:00', endTime: '15:00' },
      { name: 'Après-midi', startTime: '13:00', endTime: '21:00' },
      { name: 'Journée', startTime: '10:00', endTime: '21:00' },
    ])
  } catch (error) {
    console.error('Get shift templates error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération des templates' })
  }
})

// Update shift templates
router.put('/shift-templates', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { shiftTemplates: req.body } },
      { new: true, upsert: true }
    )
    res.json(settings.shiftTemplates)
  } catch (error) {
    console.error('Update shift templates error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour des templates' })
  }
})

// Get week number config
router.get('/week-number-config', async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.userId)
    res.json(settings.weekNumberConfig || {
      referenceDate: new Date().toISOString().split('T')[0],
      referenceWeekNumber: 1,
    })
  } catch (error) {
    console.error('Get week number config error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération de la config' })
  }
})

// Update week number config
router.put('/week-number-config', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.userId },
      { $set: { weekNumberConfig: req.body } },
      { new: true, upsert: true }
    )
    res.json(settings.weekNumberConfig)
  } catch (error) {
    console.error('Update week number config error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la config' })
  }
})

export default router