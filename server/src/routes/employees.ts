import express, { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import Employee from '../models/Employee.js'
import { auth, validateObjectIds } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Validation middleware
const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array()
    })
  }
  next()
}

/**
 * @swagger
 * /employees:
 *   get:
 *     summary: List all active employees for the current store
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of employees
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Employee'
 *       400:
 *         description: No store selected
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
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const employees = await Employee.find({
      storeId: req.storeId,
      isActive: true,
    }).sort({ firstName: 1 })

    res.json(employees)
  } catch (error) {
    logger.error({ err: error }, 'Get employees error')
    res.status(500).json({ message: 'Erreur lors de la récupération des employés' })
  }
})

/**
 * @swagger
 * /employees/{id}:
 *   get:
 *     summary: Get a single employee by ID
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Employee found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       401:
 *         description: Unauthorized
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
router.get('/:id', validateObjectIds('id'), async (req: Request, res: Response) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      storeId: req.storeId,
    })

    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }

    res.json(employee)
  } catch (error) {
    logger.error({ err: error }, 'Get employee error')
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'employé' })
  }
})

/**
 * @swagger
 * /employees:
 *   post:
 *     summary: Create a new employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - contractType
 *               - weeklyHours
 *               - color
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               contractType:
 *                 type: string
 *                 enum: [CDI, CDD, Intérim, Stage]
 *               weeklyHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 48
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Employee created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       400:
 *         description: Validation error or no store selected
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
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('phone').trim().notEmpty().withMessage('Téléphone requis'),
  body('contractType').isIn(['CDI', 'CDD', 'Intérim', 'Stage']).withMessage('Type de contrat invalide'),
  body('weeklyHours').isInt({ min: 1, max: 48 }).withMessage('Heures hebdomadaires invalides'),
  body('color').trim().notEmpty().withMessage('Couleur requise'),
  handleValidation,
], async (req: Request, res: Response) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const { firstName, lastName, email, phone, contractType, weeklyHours, color } = req.body
    const employee = new Employee({
      firstName, lastName, email, phone, contractType, weeklyHours, color,
      storeId: req.storeId,
    })
    await employee.save()

    res.status(201).json(employee)
  } catch (error) {
    logger.error({ err: error }, 'Create employee error')
    res.status(500).json({ message: 'Erreur lors de la création de l\'employé' })
  }
})

/**
 * @swagger
 * /employees/{id}:
 *   put:
 *     summary: Update an existing employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               contractType:
 *                 type: string
 *                 enum: [CDI, CDD, Intérim, Stage]
 *               weeklyHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 48
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Employee updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       401:
 *         description: Unauthorized
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
router.put('/:id', validateObjectIds('id'), async (req: Request, res: Response) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'contractType', 'weeklyHours', 'color']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field]
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, storeId: req.storeId },
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }

    res.json(employee)
  } catch (error) {
    logger.error({ err: error }, 'Update employee error')
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'employé' })
  }
})

/**
 * @swagger
 * /employees/{id}:
 *   delete:
 *     summary: Soft delete an employee (sets isActive to false)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Employee deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Employé supprimé
 *       401:
 *         description: Unauthorized
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
router.delete('/:id', validateObjectIds('id'), async (req: Request, res: Response) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, storeId: req.storeId },
      { $set: { isActive: false } },
      { new: true }
    )

    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }

    res.json({ message: 'Employé supprimé' })
  } catch (error) {
    logger.error({ err: error }, 'Delete employee error')
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'employé' })
  }
})

export default router
