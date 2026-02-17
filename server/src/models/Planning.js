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
    type: String, // Format: HH:mm ou 'CP' ou 'AM'
    required: true,
  },
  endTime: {
    type: String, // Format: HH:mm ou 'CP' ou 'AM'
    required: true,
  },
}, { _id: true })

const planningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
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
  // Validation du planning
  isValidated: {
    type: Boolean,
    default: false,
  },
  validatedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
})

// Compound index for unique planning per user per store per week
planningSchema.index({ storeId: 1, weekStart: 1 }, { unique: true })

export default mongoose.model('Planning', planningSchema)