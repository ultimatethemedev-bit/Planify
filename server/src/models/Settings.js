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

const shiftTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
}, { _id: false })

const weekNumberConfigSchema = new mongoose.Schema({
  referenceDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0],
  },
  referenceWeekNumber: {
    type: Number,
    default: 1,
  },
}, { _id: false })

const settingsSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    unique: true,
  },
  storeHours: {
    type: storeHoursSchema,
    default: () => ({}),
  },
  events: [commercialEventSchema],
  shiftTemplates: {
    type: [shiftTemplateSchema],
    default: [
      { name: 'Matin', startTime: '10:00', endTime: '15:00' },
      { name: 'Après-midi', startTime: '13:00', endTime: '21:00' },
      { name: 'Journée', startTime: '10:00', endTime: '21:00' },
    ],
  },
  weekNumberConfig: {
    type: weekNumberConfigSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
})

export default mongoose.model('Settings', settingsSchema)