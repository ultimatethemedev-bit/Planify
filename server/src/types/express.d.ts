import { Types } from 'mongoose'
import { IUser } from '../models/User.js'

declare global {
  namespace Express {
    interface Request {
      user?: IUser
      userId?: Types.ObjectId
      storeId?: Types.ObjectId | null
      userRole?: string | null
    }
  }
}
