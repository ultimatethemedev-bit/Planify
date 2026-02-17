import express from 'express'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import Store from '../models/Store.js'
import Invitation from '../models/Invitation.js'
import Settings from '../models/Settings.js'
import { auth, generateToken } from '../middleware/auth.js'
import { sendWelcomeEmail } from '../utils/email.js'

const router = express.Router()

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  message: { message: 'Trop de créations de compte, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
})

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

// Helper: build stores array with roles for a user
const getUserStores = async (userId) => {
  const stores = await Store.find({ 'members.userId': userId })
  return stores.map(s => ({
    _id: s._id,
    name: s.name,
    role: s.members.find(m => m.userId.toString() === userId.toString())?.role,
  }))
}

// Check invitation code validity (public - used on register page)
router.get('/invitation-info/:code', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({
      code: req.params.code.toUpperCase(),
      usedBy: null,
      expiresAt: { $gt: new Date() },
    })

    if (!invitation) {
      return res.status(404).json({ message: 'Code invalide ou expiré' })
    }

    const store = await Store.findById(invitation.storeId, 'name')
    res.json({ storeName: store?.name || 'Boutique' })
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Register
router.post('/register', registerLimiter, [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('store1').custom((value, { req }) => {
    if (!req.body.invitationCode && (!value || !value.trim())) {
      throw new Error('Nom de la boutique 1 requis')
    }
    return true
  }),
  handleValidation,
], async (req, res) => {
  try {
    const { email, password, firstName, lastName, store1, store2, invitationCode } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    }

    // Path A: Registration with invitation code
    if (invitationCode) {
      const invitation = await Invitation.findOne({
        code: invitationCode.toUpperCase(),
        usedBy: null,
        expiresAt: { $gt: new Date() },
      })

      if (!invitation) {
        return res.status(400).json({ message: 'Code d\'invitation invalide ou expiré' })
      }

      const store = await Store.findById(invitation.storeId)
      if (!store) {
        return res.status(400).json({ message: 'Boutique introuvable' })
      }

      // Create user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        stores: [],
        currentStoreId: store._id,
      })
      await user.save()

      // Add user as member
      store.members.push({
        userId: user._id,
        role: 'member',
      })
      await store.save()

      // Mark invitation as used
      invitation.usedBy = user._id
      invitation.usedAt = new Date()
      await invitation.save()

      // Send welcome email
      sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`).catch(err => {
        console.error('Erreur envoi email bienvenue (non bloquant):', err)
      })

      const token = generateToken(user._id)
      const stores = await getUserStores(user._id)

      return res.status(201).json({
        user: {
          ...user.toJSON(),
          stores,
        },
        token,
      })
    }

    // Path B: Standard registration (create new store)
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      stores: [],
      currentStoreId: null,
    })
    await user.save()

    // Create Store(s)
    const store1Doc = await Store.create({
      name: store1,
      members: [{ userId: user._id, role: 'owner' }],
    })

    let store2Doc = null
    if (store2 && store2.trim()) {
      store2Doc = await Store.create({
        name: store2.trim(),
        members: [{ userId: user._id, role: 'owner' }],
      })
    }

    // Set current store
    user.currentStoreId = store1Doc._id
    await user.save()

    // Create default settings for each store
    await Settings.create({ storeId: store1Doc._id })
    if (store2Doc) {
      await Settings.create({ storeId: store2Doc._id })
    }

    // Send welcome email
    sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`).catch(err => {
      console.error('Erreur envoi email bienvenue (non bloquant):', err)
    })

    const token = generateToken(user._id)
    const stores = await getUserStores(user._id)

    res.status(201).json({
      user: {
        ...user.toJSON(),
        stores,
      },
      token,
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Erreur lors de la création du compte' })
  }
})

// Login
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidation,
], async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }

    const token = generateToken(user._id)
    const stores = await getUserStores(user._id)

    res.json({
      user: {
        ...user.toJSON(),
        stores,
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Erreur lors de la connexion' })
  }
})

// Get current user
router.get('/me', auth, async (req, res) => {
  const stores = await getUserStores(req.userId)
  res.json({
    ...req.user.toJSON(),
    stores,
  })
})

// Switch store
router.put('/switch-store', auth, async (req, res) => {
  try {
    const { storeId } = req.body

    // Verify user is a member of this store
    const store = await Store.findOne({
      _id: storeId,
      'members.userId': req.userId,
    })

    if (!store) {
      return res.status(404).json({ message: 'Boutique non trouvée' })
    }

    req.user.currentStoreId = storeId
    await req.user.save()

    const stores = await getUserStores(req.userId)

    res.json({
      ...req.user.toJSON(),
      stores,
    })
  } catch (error) {
    console.error('Switch store error:', error)
    res.status(500).json({ message: 'Erreur lors du changement de boutique' })
  }
})

export default router
