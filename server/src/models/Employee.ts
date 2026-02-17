import mongoose, { Document } from 'mongoose'

export interface IEmployee extends Document {
  userId?: mongoose.Types.ObjectId
  storeId: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  email: string
  phone: string
  contractType: 'CDI' | 'CDD' | 'Alternant' | 'Stage'
  weeklyHours: number
  color: string
  avatar: string | null
  isActive: boolean
  cpBalance: number
  cpPerMonth: number
  cpStartDate: Date
}

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  contractType: {
    type: String,
    required: true,
    enum: ['CDI', 'CDD', 'Alternant', 'Stage'],
    default: 'CDI',
  },
  weeklyHours: {
    type: Number,
    required: true,
    default: 35,
    min: 1,
    max: 48,
  },
  color: {
    type: String,
    required: true,
    default: '#3B82F6',
  },
  avatar: {
    type: String,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  cpBalance: {
    type: Number,
    default: 0,
  },
  cpPerMonth: {
    type: Number,
    default: 2.5,
  },
  cpStartDate: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
})

employeeSchema.index({ storeId: 1, isActive: 1 })

export default mongoose.model<IEmployee>('Employee', employeeSchema)
