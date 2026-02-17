import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Store from '../models/Store.js'

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Non autorisé' })
    }

    const token = authHeader.split(' ')[1]

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' })
    }

    req.user = user
    req.userId = user._id

    // Resolve current store and membership
    if (user.currentStoreId) {
      const store = await Store.findOne({
        _id: user.currentStoreId,
        'members.userId': user._id,
      })

      if (store) {
        req.storeId = store._id
        const member = store.members.find(
          m => m.userId.toString() === user._id.toString()
        )
        req.userRole = member ? member.role : null
      } else {
        req.storeId = null
        req.userRole = null
      }
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token invalide' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expiré' })
    }
    res.status(500).json({ message: 'Erreur serveur' })
  }
}

export const requireRole = (role) => (req, res, next) => {
  if (req.userRole !== role) {
    return res.status(403).json({
      message: 'Accès refusé. Droits insuffisants.',
    })
  }
  next()
}

export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}
