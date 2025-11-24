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
  body('companyName').trim().notEmpty().withMessage('Nom de boutique requis'),
  handleValidation,
], async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body
    
    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    }
    
    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      companyName,
    })
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

export default router
