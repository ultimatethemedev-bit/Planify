import mongoose from 'mongoose'

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'member'],
    default: 'member',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false })

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  members: [memberSchema],
}, {
  timestamps: true,
})

storeSchema.index({ 'members.userId': 1 })

export default mongoose.model('Store', storeSchema)
