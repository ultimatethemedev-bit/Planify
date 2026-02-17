import express from 'express'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import Store from '../models/Store.js'
import { auth } from '../middleware/auth.js'
import bcrypt from 'bcryptjs'

const router = express.Router()

// Toutes les routes nécessitent authentification
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

// Helper: build stores array with roles for a user
const getUserStores = async (userId) => {
  const stores = await Store.find({ 'members.userId': userId })
  return stores.map(s => ({
    _id: s._id,
    name: s.name,
    role: s.members.find(m => m.userId.toString() === userId.toString())?.role,
  }))
}

// PUT /api/user/profile - Modifier profil (nom, prénom, email)
router.put('/profile', [
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('email').isEmail().withMessage('Email invalide'),
  handleValidation,
], async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body

    if (email !== req.user.email) {
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' })
      }
    }

    req.user.firstName = firstName
    req.user.lastName = lastName
    req.user.email = email
    await req.user.save()

    const stores = await getUserStores(req.userId)

    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        ...req.user.toJSON(),
        stores,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' })
  }
})

// PUT /api/user/password - Changer mot de passe
router.put('/password', [
  body('oldPassword').notEmpty().withMessage('Ancien mot de passe requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Les mots de passe ne correspondent pas')
    }
    return true
  }),
  handleValidation,
], async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    const isMatch = await bcrypt.compare(oldPassword, req.user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Ancien mot de passe incorrect' })
    }

    req.user.password = newPassword
    await req.user.save()

    res.json({ message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    console.error('Update password error:', error)
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' })
  }
})

// PUT /api/user/stores/:storeId - Renommer une boutique (owner only)
router.put('/stores/:storeId', [
  body('name').trim().notEmpty().withMessage('Nom de la boutique requis'),
  handleValidation,
], async (req, res) => {
  try {
    const { storeId } = req.params
    const { name } = req.body

    const store = await Store.findOne({
      _id: storeId,
      'members.userId': req.userId,
    })

    if (!store) {
      return res.status(404).json({ message: 'Boutique non trouvée' })
    }

    const member = store.members.find(
      m => m.userId.toString() === req.userId.toString()
    )
    if (!member || member.role !== 'owner') {
      return res.status(403).json({ message: 'Seul le propriétaire peut renommer la boutique' })
    }

    store.name = name
    await store.save()

    const stores = await getUserStores(req.userId)

    res.json({
      message: 'Boutique renommée avec succès',
      user: {
        ...req.user.toJSON(),
        stores,
      },
    })
  } catch (error) {
    console.error('Update store error:', error)
    res.status(500).json({ message: 'Erreur lors du renommage de la boutique' })
  }
})

export default router
