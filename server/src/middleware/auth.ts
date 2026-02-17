import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Store from '../models/Store.js'

interface JwtPayload {
  userId: string
}

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Non autorisé' })
      return
    }

    const token = authHeader.split(' ')[1]

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload

    const user = await User.findById(decoded.userId)

    if (!user) {
      res.status(401).json({ message: 'Utilisateur non trouvé' })
      return
    }

    req.user = user
    req.userId = user._id as mongoose.Types.ObjectId

    // Resolve current store and membership
    if (user.currentStoreId) {
      const store = await Store.findOne({
        _id: user.currentStoreId,
        'members.userId': user._id,
      })

      if (store) {
        req.storeId = store._id as mongoose.Types.ObjectId
        const member = store.members.find(
          m => m.userId.toString() === (user._id as mongoose.Types.ObjectId).toString()
        )
        req.userRole = member ? member.role : null
      } else {
        req.storeId = null
        req.userRole = null
      }
    }

    next()
  } catch (error) {
    if ((error as Error).name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' })
      return
    }
    if ((error as Error).name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expiré' })
      return
    }
    res.status(500).json({ message: 'Erreur serveur' })
  }
}

export const requireRole = (role: string) => (req: Request, res: Response, next: NextFunction): void => {
  if (req.userRole !== role) {
    res.status(403).json({
      message: 'Accès refusé. Droits insuffisants.',
    })
    return
  }
  next()
}

export const validateObjectIds = (...paramNames: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  for (const param of paramNames) {
    const value = req.params[param]
    if (value && !mongoose.Types.ObjectId.isValid(value as string)) {
      res.status(400).json({ message: `Paramètre invalide: ${param}` })
      return
    }
  }
  next()
}

export const generateToken = (userId: mongoose.Types.ObjectId): string => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  )
}
