import mongoose from 'mongoose'

// Historique des modifications d'un jour
const modificationSchema = new mongoose.Schema({
  changedAt: {
    type: Date,
    default: Date.now,
  },
  field: {
    type: String, // 'actualStart', 'actualEnd', 'type'
    required: true,
  },
  from: {
    type: String,
  },
  to: {
    type: String,
  },
}, { _id: false })

// Données d'un jour
const dayEntrySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  type: {
    type: String,
    enum: ['work', 'rest', 'cp', 'am'], // travail, repos, congé payé, arrêt maladie
    default: 'work',
  },
  // Heures prévues (snapshot du planning validé)
  plannedStart: {
    type: String,
    default: null,
  },
  plannedEnd: {
    type: String,
    default: null,
  },
  plannedMinutes: {
    type: Number,
    default: 0,
  },
  // Heures réalisées (modifiables après validation)
  actualStart: {
    type: String,
    default: null,
  },
  actualEnd: {
    type: String,
    default: null,
  },
  actualMinutes: {
    type: Number,
    default: 0,
  },
  // Delta en minutes (actualMinutes - plannedMinutes)
  deltaMinutes: {
    type: Number,
    default: 0,
  },
  // Note optionnelle (retard, heures supp, etc.)
  note: {
    type: String,
    trim: true,
    default: '',
  },
  // Historique des modifications
  modifications: [modificationSchema],
}, { _id: false })

const timesheetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  // Semaine concernée
  weekStart: {
    type: String, // Format: YYYY-MM-DD (Lundi)
    required: true,
  },
  weekEnd: {
    type: String, // Format: YYYY-MM-DD (Dimanche)
    required: true,
  },
  // Données par jour (7 jours)
  days: [dayEntrySchema],
  // Totaux de la semaine
  totalPlannedMinutes: {
    type: Number,
    default: 0,
  },
  totalActualMinutes: {
    type: Number,
    default: 0,
  },
  totalDeltaMinutes: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
})

// Index unique par employé par semaine par boutique
timesheetSchema.index({ storeId: 1, employeeId: 1, weekStart: 1 }, { unique: true })

// Méthode pour recalculer les totaux
timesheetSchema.methods.recalculateTotals = function() {
  let totalPlanned = 0
  let totalActual = 0
  
  this.days.forEach(day => {
    if (day.type === 'work') {
      totalPlanned += day.plannedMinutes || 0
      totalActual += day.actualMinutes || 0
    }
  })
  
  this.totalPlannedMinutes = totalPlanned
  this.totalActualMinutes = totalActual
  this.totalDeltaMinutes = totalActual - totalPlanned
  
  return this
}

export default mongoose.model('Timesheet', timesheetSchema)