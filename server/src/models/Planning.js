import mongoose from 'mongoose'

const shiftSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  startTime: {
    type: String, // Format: HH:mm
    required: true,
  },
  endTime: {
    type: String, // Format: HH:mm
    required: true,
  },
}, { _id: true })

const planningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  weekStart: {
    type: String, // Format: YYYY-MM-DD (Monday)
    required: true,
  },
  weekEnd: {
    type: String, // Format: YYYY-MM-DD (Sunday)
    required: true,
  },
  shifts: [shiftSchema],
}, {
  timestamps: true,
})

// Compound index for unique planning per user per week
planningSchema.index({ userId: 1, weekStart: 1 }, { unique: true })

export default mongoose.model('Planning', planningSchema)
