import express from 'express'
import crypto from 'crypto'
import Store from '../models/Store.js'
import User from '../models/User.js'
import Invitation from '../models/Invitation.js'
import { auth, requireRole } from '../middleware/auth.js'

const router = express.Router()
router.use(auth)

// GET /stores/current/members
router.get('/current/members', async (req, res) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const store = await Store.findById(req.storeId)
    if (!store) {
      return res.status(404).json({ message: 'Boutique non trouvée' })
    }

    const memberDetails = await Promise.all(
      store.members.map(async (member) => {
        const user = await User.findById(member.userId, 'firstName lastName email')
        return {
          userId: member.userId,
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
          role: member.role,
          joinedAt: member.joinedAt,
        }
      })
    )

    res.json(memberDetails)
  } catch (error) {
    console.error('Get members error:', error)
    res.status(500).json({ message: 'Erreur lors de la récupération des membres' })
  }
})

// POST /stores/invitations (owner only)
router.post('/invitations', requireRole('owner'), async (req, res) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    // Generate unique 6-char code
    let code
    let exists = true
    while (exists) {
      code = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase()
      exists = await Invitation.findOne({ code })
    }

    const invitation = await Invitation.create({
      code,
      storeId: req.storeId,
      createdBy: req.userId,
    })

    res.status(201).json({
      code: invitation.code,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error('Create invitation error:', error)
    res.status(500).json({ message: 'Erreur lors de la création de l\'invitation' })
  }
})

// GET /stores/invitations (owner only)
router.get('/invitations', requireRole('owner'), async (req, res) => {
  try {
    if (!req.storeId) {
      return res.status(400).json({ message: 'Aucune boutique sélectionnée' })
    }

    const invitations = await Invitation.find({
      storeId: req.storeId,
      expiresAt: { $gt: new Date() },
      usedBy: null,
    }).sort({ createdAt: -1 })

    res.json(invitations)
  } catch (error) {
    console.error('Get invitations error:', error)
    res.status(500).json({ message: 'Erreur' })
  }
})

// DELETE /stores/invitations/:code (owner only)
router.delete('/invitations/:code', requireRole('owner'), async (req, res) => {
  try {
    await Invitation.findOneAndDelete({
      code: req.params.code,
      storeId: req.storeId,
      usedBy: null,
    })
    res.json({ message: 'Invitation révoquée' })
  } catch (error) {
    console.error('Delete invitation error:', error)
    res.status(500).json({ message: 'Erreur' })
  }
})

// DELETE /stores/members/:userId (owner only)
router.delete('/members/:userId', requireRole('owner'), async (req, res) => {
  try {
    if (req.params.userId === req.userId.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous retirer vous-même' })
    }

    const store = await Store.findById(req.storeId)
    if (!store) {
      return res.status(404).json({ message: 'Boutique non trouvée' })
    }

    store.members = store.members.filter(
      m => m.userId.toString() !== req.params.userId
    )
    await store.save()

    res.json({ message: 'Membre retiré' })
  } catch (error) {
    console.error('Remove member error:', error)
    res.status(500).json({ message: 'Erreur' })
  }
})

export default router
