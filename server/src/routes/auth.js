import express from 'express'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import Settings from '../models/Settings.js'
import { auth, generateToken } from '../middleware/auth.js'

const router = express.Router()

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

// Register
router.post('/register', [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('store1').trim().notEmpty().withMessage('Nom de la boutique 1 requis'),
  handleValidation,
], async (req, res) => {
  try {
    const { email, password, firstName, lastName, store1, store2 } = req.body
    
    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    }
    
    // Créer les boutiques
    const stores = [{ name: store1 }]
    if (store2 && store2.trim()) {
      stores.push({ name: store2.trim() })
    }
    
    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      stores,
      currentStoreId: null, // Sera défini après save
    })
    await user.save()
    
    // Définir la première boutique comme boutique courante
    user.currentStoreId = user.stores[0]._id
    await user.save()
    
    // Create default settings
    await Settings.create({ userId: user._id })
    
    // Generate token
    const token = generateToken(user._id)
    
    res.status(201).json({
      user: user.toJSON(),
      token,
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Erreur lors de la création du compte' })
  }
})

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidation,
], async (req, res) => {
  try {
    const { email, password } = req.body
    
    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }
    
    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }
    
    // Generate token
    const token = generateToken(user._id)
    
    res.json({
      user: user.toJSON(),
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Erreur lors de la connexion' })
  }
})

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user.toJSON())
})

// Switch store
router.put('/switch-store', auth, async (req, res) => {
  try {
    const { storeId } = req.body
    
    // Vérifier que la boutique appartient à l'utilisateur
    const store = req.user.stores.find(s => s._id.toString() === storeId)
    if (!store) {
      return res.status(404).json({ message: 'Boutique non trouvée' })
    }
    
    // Mettre à jour la boutique courante
    req.user.currentStoreId = storeId
    await req.user.save()
    
    res.json(req.user.toJSON())
  } catch (error) {
    console.error('Switch store error:', error)
    res.status(500).json({ message: 'Erreur lors du changement de boutique' })
  }
})

export default router