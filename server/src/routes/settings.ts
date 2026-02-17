import express, { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import Settings, { ISettings } from '../models/Settings.js'
import { auth, requireRole, validateObjectIds } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Helper to get or create settings
const getOrCreateSettings = async (storeId: ISettings['storeId']): Promise<ISettings> => {
  let settings = await Settings.findOne({ storeId })
  if (!settings) {
    settings = await Settings.create({ storeId })
  }
  return settings
}

// Get store hours
router.get('/store-hours', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.storeId!)
    res.json(settings.storeHours)
  } catch (error) {
    logger.error({ err: error }, 'Get store hours error')
    res.status(500).json({ message: 'Erreur lors de la récupération des horaires' })
  }
})

// Update store hours (owner only)
router.put('/store-hours', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const storeHours: Record<string, { isOpen: boolean; openTime: string; closeTime: string }> = {}
    for (const day of days) {
      if (req.body[day]) {
        storeHours[day] = {
          isOpen: Boolean(req.body[day].isOpen),
          openTime: String(req.body[day].openTime || '10:00'),
          closeTime: String(req.body[day].closeTime || '21:00'),
        }
      }
    }

    const settings = await Settings.findOneAndUpdate(
      { storeId: req.storeId },
      { $set: { storeHours } },
      { new: true, upsert: true }
    )
    res.json(settings!.storeHours)
  } catch (error) {
    logger.error({ err: error }, 'Update store hours error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour des horaires' })
  }
})

// Get all events
router.get('/events', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.storeId!)
    res.json(settings.events)
  } catch (error) {
    logger.error({ err: error }, 'Get events error')
    res.status(500).json({ message: 'Erreur lors de la récupération des événements' })
  }
})

// Create event (owner only)
router.post('/events', requireRole('owner'), [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('startDate').notEmpty().withMessage('Date de début requise'),
  body('endDate').notEmpty().withMessage('Date de fin requise'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg })
    }

    const settings = await getOrCreateSettings(req.storeId!)

    const newEvent = {
      name: req.body.name,
      emoji: req.body.emoji || '',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      color: req.body.color || '#F97316',
    }

    settings.events.push(newEvent as ISettings['events'][number])
    await settings.save()

    const createdEvent = settings.events[settings.events.length - 1]
    res.status(201).json(createdEvent)
  } catch (error) {
    logger.error({ err: error }, 'Create event error')
    res.status(500).json({ message: 'Erreur lors de la création de l\'événement' })
  }
})

// Update event (owner only)
router.put('/events/:id', requireRole('owner'), validateObjectIds('id'), async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.storeId!)

    const eventIndex = settings.events.findIndex(
      e => e._id.toString() === req.params.id
    )

    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Événement non trouvé' })
    }

    const eventFields = ['name', 'emoji', 'startDate', 'endDate', 'color'] as const
    for (const field of eventFields) {
      if (req.body[field] !== undefined) settings.events[eventIndex][field] = req.body[field]
    }
    await settings.save()

    res.json(settings.events[eventIndex])
  } catch (error) {
    logger.error({ err: error }, 'Update event error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'événement' })
  }
})

// Delete event (owner only)
router.delete('/events/:id', requireRole('owner'), validateObjectIds('id'), async (req: Request, res: Response) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { storeId: req.storeId },
      { $pull: { events: { _id: req.params.id } } },
      { new: true }
    )

    if (!settings) {
      return res.status(404).json({ message: 'Événement non trouvé' })
    }

    res.json({ message: 'Événement supprimé' })
  } catch (error) {
    logger.error({ err: error }, 'Delete event error')
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'événement' })
  }
})

// Get shift templates
router.get('/shift-templates', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.storeId!)
    res.json(settings.shiftTemplates || [
      { name: 'Matin', startTime: '10:00', endTime: '15:00' },
      { name: 'Après-midi', startTime: '13:00', endTime: '21:00' },
      { name: 'Journée', startTime: '10:00', endTime: '21:00' },
    ])
  } catch (error) {
    logger.error({ err: error }, 'Get shift templates error')
    res.status(500).json({ message: 'Erreur lors de la récupération des templates' })
  }
})

// Update shift templates (owner only)
router.put('/shift-templates', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Format invalide' })
    }
    const shiftTemplates: ISettings['shiftTemplates'] = req.body.map((t: Record<string, unknown>) => ({
      name: String(t.name || ''),
      startTime: String(t.startTime || ''),
      endTime: String(t.endTime || ''),
    }))

    const settings = await Settings.findOneAndUpdate(
      { storeId: req.storeId },
      { $set: { shiftTemplates } },
      { new: true, upsert: true }
    )
    res.json(settings!.shiftTemplates)
  } catch (error) {
    logger.error({ err: error }, 'Update shift templates error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour des templates' })
  }
})

// Get week number config
router.get('/week-number-config', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.storeId!)
    res.json(settings.weekNumberConfig || {
      referenceDate: new Date().toISOString().split('T')[0],
      referenceWeekNumber: 1,
    })
  } catch (error) {
    logger.error({ err: error }, 'Get week number config error')
    res.status(500).json({ message: 'Erreur lors de la récupération de la config' })
  }
})

// Update week number config (owner only)
router.put('/week-number-config', requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const weekNumberConfig: ISettings['weekNumberConfig'] = {
      referenceDate: String(req.body.referenceDate || ''),
      referenceWeekNumber: Number(req.body.referenceWeekNumber) || 1,
    }

    const settings = await Settings.findOneAndUpdate(
      { storeId: req.storeId },
      { $set: { weekNumberConfig } },
      { new: true, upsert: true }
    )
    res.json(settings!.weekNumberConfig)
  } catch (error) {
    logger.error({ err: error }, 'Update week number config error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la config' })
  }
})

export default router
