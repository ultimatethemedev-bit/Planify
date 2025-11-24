import mongoose from 'mongoose'

const dayHoursSchema = new mongoose.Schema({
  isOpen: {
    type: Boolean,
    default: true,
  },
  openTime: {
    type: String,
    default: '10:00',
  },
  closeTime: {
    type: String,
    default: '21:00',
  },
}, { _id: false })

const storeHoursSchema = new mongoose.Schema({
  monday: { type: dayHoursSchema, default: () => ({}) },
  tuesday: { type: dayHoursSchema, default: () => ({}) },
  wednesday: { type: dayHoursSchema, default: () => ({}) },
  thursday: { type: dayHoursSchema, default: () => ({}) },
  friday: { type: dayHoursSchema, default: () => ({}) },
  saturday: { type: dayHoursSchema, default: () => ({}) },
  sunday: { 
    type: dayHoursSchema, 
    default: () => ({ isOpen: true, openTime: '10:00', closeTime: '19:00' }) 
  },
}, { _id: false })

const commercialEventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  emoji: {
    type: String,
    default: '🔥',
  },
  startDate: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  endDate: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  color: {
    type: String,
    default: '#F97316',
  },
})

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  storeHours: {
    type: storeHoursSchema,
    default: () => ({}),
  },
  events: [commercialEventSchema],
}, {
  timestamps: true,
})

export default mongoose.model('Settings', settingsSchema)
