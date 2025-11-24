import mongoose from 'mongoose'

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    enum: ['CDI', 'CDD', 'Intérim', 'Stage'],
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
}, {
  timestamps: true,
})

// Index for faster queries
employeeSchema.index({ userId: 1, isActive: 1 })

export default mongoose.model('Employee', employeeSchema)
