import express from 'express'
import { body, validationResult } from 'express-validator'
import Employee from '../models/Employee.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(auth)

// Validation middleware
const handleValidation = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: errors.array()[0].msg,
      errors: errors.array() 
    })
  }
  next()
}

// Get all employees (filtered by current store)
router.get('/', async (req, res) => {
  try {
    const query = { 
      userId: req.userId,
      isActive: true 
    }
    
    // Filtrer par boutique si l'utilisateur a un currentStoreId
    if (req.user.currentStoreId) {
      query.storeId = req.user.currentStoreId
    }
    
    const employees = await Employee.find(query).sort({ firstName: 1 })
    
    res.json(employees)
  } catch (error) {
    console.error('Get employees error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération des employés' })
  }
})

// Get single employee
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.userId,
    })
    
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }
    
    res.json(employee)
  } catch (error) {
    console.error('Get employee error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'employé' })
  }
})

// Create employee
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('phone').trim().notEmpty().withMessage('Téléphone requis'),
  body('contractType').isIn(['CDI', 'CDD', 'Intérim', 'Stage']).withMessage('Type de contrat invalide'),
  body('weeklyHours').isInt({ min: 1, max: 48 }).withMessage('Heures hebdomadaires invalides'),
  body('color').trim().notEmpty().withMessage('Couleur requise'),
  handleValidation,
], async (req, res) => {
  try {
    // Vérifier que l'utilisateur a une boutique sélectionnée
    if (!req.user.currentStoreId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }
    
    const employee = new Employee({
      ...req.body,
      userId: req.userId,
      storeId: req.user.currentStoreId,
    })
    await employee.save()
    
    res.status(201).json(employee)
  } catch (error) {
    console.error('Create employee error:', error)
    res.status(500).json({ message: 'Erreur lors de la création de l\'employé' })
  }
})

// Update employee
router.put('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    )
    
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }
    
    res.json(employee)
  } catch (error) {
    console.error('Update employee error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'employé' })
  }
})

// Delete employee (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { isActive: false } },
      { new: true }
    )
    
    if (!employee) {
      return res.status(404).json({ message: 'Employé non trouvé' })
    }
    
    res.json({ message: 'Employé supprimé' })
  } catch (error) {
    console.error('Delete employee error:', error)
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'employé' })
  }
})

export default router