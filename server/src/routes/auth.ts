import express, { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import Store from '../models/Store.js'
import Invitation from '../models/Invitation.js'
import Settings from '../models/Settings.js'
import { auth, generateToken } from '../middleware/auth.js'
import { sendWelcomeEmail } from '../utils/email.js'
import { logger } from '../utils/logger.js'
import mongoose from 'mongoose'

const router = express.Router()

// Rate limiting for auth endpoints (disabled in tests)
const isTest = process.env.NODE_ENV === 'test'
const noopMiddleware = (_req: Request, _res: Response, next: NextFunction) => next()

const authLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Trop de créations de compte, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Validation middleware
const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array()
    })
    return
  }
  next()
}

interface UserStoreEntry {
  _id: mongoose.Types.ObjectId
  name: string
  role: string | undefined
}

// Helper: build stores array with roles for a user
const getUserStores = async (userId: mongoose.Types.ObjectId): Promise<UserStoreEntry[]> => {
  const stores = await Store.find({ 'members.userId': userId })
  return stores.map(s => ({
    _id: s._id as mongoose.Types.ObjectId,
    name: s.name,
    role: s.members.find(m => m.userId.toString() === userId.toString())?.role,
  }))
}

/**
 * @swagger
 * /auth/invitation-info/{code}:
 *   get:
 *     summary: Check invitation code validity
 *     description: Returns the store name associated with a valid, unused invitation code.
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: The invitation code to validate
 *     responses:
 *       200:
 *         description: Invitation code is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 storeName:
 *                   type: string
 *                   description: Name of the store associated with the invitation
 *       404:
 *         description: Invalid or expired invitation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Check invitation code validity (public - used on register page)
router.get('/invitation-info/:code', async (req: Request, res: Response) => {
  try {
    const invitation = await Invitation.findOne({
      code: (req.params.code as string).toUpperCase(),
      usedBy: null,
      expiresAt: { $gt: new Date() },
    })

    if (!invitation) {
      res.status(404).json({ message: 'Code invalide ou expiré' })
      return
    }

    const store = await Store.findById(invitation.storeId, 'name')
    res.json({ storeName: store?.name || 'Boutique' })
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: >
 *       Creates a new user account. Two registration paths are supported:
 *       with an invitation code (joins an existing store as a member) or
 *       without one (creates one or two new stores as owner).
 *       Rate-limited to 5 requests per hour.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               store1:
 *                 type: string
 *                 description: Name of the first store (required when no invitationCode)
 *               store2:
 *                 type: string
 *                 description: Optional name of a second store
 *               invitationCode:
 *                 type: string
 *                 description: Invitation code to join an existing store
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT bearer token
 *       400:
 *         description: Validation error, email already in use, or invalid invitation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
], async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, store1, store2, invitationCode } = req.body as {
      email: string
      password: string
      firstName: string
      lastName: string
      store1: string
      store2?: string
      invitationCode?: string
    }

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ message: 'Cet email est déjà utilisé' })
      return
    }

    // Path A: Registration with invitation code
    if (invitationCode) {
      const invitation = await Invitation.findOne({
        code: invitationCode.toUpperCase(),
        usedBy: null,
        expiresAt: { $gt: new Date() },
      })

      if (!invitation) {
        res.status(400).json({ message: 'Code d\'invitation invalide ou expiré' })
        return
      }

      const store = await Store.findById(invitation.storeId)
      if (!store) {
        res.status(400).json({ message: 'Boutique introuvable' })
        return
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
        userId: user._id as mongoose.Types.ObjectId,
        role: 'member',
        joinedAt: new Date(),
      })
      await store.save()

      // Mark invitation as used
      invitation.usedBy = user._id as mongoose.Types.ObjectId
      invitation.usedAt = new Date()
      await invitation.save()

      // Send welcome email
      sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`).catch((err: unknown) => {
        logger.error({ err }, 'Erreur envoi email bienvenue (non bloquant)')
      })

      const token = generateToken(user._id as mongoose.Types.ObjectId)
      const stores = await getUserStores(user._id as mongoose.Types.ObjectId)

      res.status(201).json({
        user: {
          ...user.toJSON(),
          stores,
        },
        token,
      })
      return
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
    user.currentStoreId = store1Doc._id as mongoose.Types.ObjectId
    await user.save()

    // Create default settings for each store
    await Settings.create({ storeId: store1Doc._id })
    if (store2Doc) {
      await Settings.create({ storeId: store2Doc._id })
    }

    // Send welcome email
    sendWelcomeEmail(user.email, `${user.firstName} ${user.lastName}`).catch((err: unknown) => {
      logger.error({ err }, 'Erreur envoi email bienvenue (non bloquant)')
    })

    const token = generateToken(user._id as mongoose.Types.ObjectId)
    const stores = await getUserStores(user._id as mongoose.Types.ObjectId)

    res.status(201).json({
      user: {
        ...user.toJSON(),
        stores,
      },
      token,
    })
  } catch (error) {
    logger.error({ err: error }, 'Register error')
    res.status(500).json({ message: 'Erreur lors de la création du compte' })
  }
})

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: Authenticates a user and returns a JWT token. Rate-limited to 10 requests per 15 minutes.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT bearer token
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Login
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidation,
], async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string }

    const user = await User.findOne({ email })
    if (!user) {
      res.status(401).json({ message: 'Email ou mot de passe incorrect' })
      return
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      res.status(401).json({ message: 'Email ou mot de passe incorrect' })
      return
    }

    const token = generateToken(user._id as mongoose.Types.ObjectId)
    const stores = await getUserStores(user._id as mongoose.Types.ObjectId)

    res.json({
      user: {
        ...user.toJSON(),
        stores,
      },
      token,
    })
  } catch (error) {
    logger.error({ err: error }, 'Login error')
    res.status(500).json({ message: 'Erreur lors de la connexion' })
  }
})

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     description: Returns the profile of the currently authenticated user along with their store memberships.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get current user
router.get('/me', auth, async (req: Request, res: Response) => {
  const stores = await getUserStores(req.userId!)
  res.json({
    ...req.user!.toJSON(),
    stores,
  })
})

/**
 * @swagger
 * /auth/switch-store:
 *   put:
 *     summary: Switch the active store for the current user
 *     description: Updates the user's active store context. The user must already be a member of the target store.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *             properties:
 *               storeId:
 *                 type: string
 *                 description: ID of the store to switch to
 *     responses:
 *       200:
 *         description: Store switched successfully, returns updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Store not found or user is not a member
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Switch store
router.put('/switch-store', auth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.body as { storeId: string }

    // Verify user is a member of this store
    const store = await Store.findOne({
      _id: storeId,
      'members.userId': req.userId,
    })

    if (!store) {
      res.status(404).json({ message: 'Boutique non trouvée' })
      return
    }

    req.user!.currentStoreId = storeId as unknown as mongoose.Types.ObjectId
    await req.user!.save()

    const stores = await getUserStores(req.userId!)

    res.json({
      ...req.user!.toJSON(),
      stores,
    })
  } catch (error) {
    logger.error({ err: error }, 'Switch store error')
    res.status(500).json({ message: 'Erreur lors du changement de boutique' })
  }
})

export default router
