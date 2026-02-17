import mongoose from 'mongoose'

const invitationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  usedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
})

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 })

export default mongoose.model('Invitation', invitationSchema)
