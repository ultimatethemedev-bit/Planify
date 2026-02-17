import mongoose, { Document } from 'mongoose'

interface IModification {
  changedAt: Date
  field: string
  from?: string
  to?: string
}

export interface IDayEntry {
  date: string
  type: 'work' | 'rest' | 'cp' | 'am'
  plannedStart: string | null
  plannedEnd: string | null
  plannedMinutes: number
  actualStart: string | null
  actualEnd: string | null
  actualMinutes: number
  deltaMinutes: number
  note: string
  modifications: IModification[]
}

export interface ITimesheet extends Document {
  userId?: mongoose.Types.ObjectId
  storeId: mongoose.Types.ObjectId
  employeeId: mongoose.Types.ObjectId
  weekStart: string
  weekEnd: string
  days: IDayEntry[]
  totalPlannedMinutes: number
  totalActualMinutes: number
  totalDeltaMinutes: number
  recalculateTotals(): ITimesheet
}

const modificationSchema = new mongoose.Schema({
  changedAt: {
    type: Date,
    default: Date.now,
  },
  field: {
    type: String,
    required: true,
  },
  from: {
    type: String,
  },
  to: {
    type: String,
  },
}, { _id: false })

const dayEntrySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['work', 'rest', 'cp', 'am'],
    default: 'work',
  },
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
  deltaMinutes: {
    type: Number,
    default: 0,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
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
  weekStart: {
    type: String,
    required: true,
  },
  weekEnd: {
    type: String,
    required: true,
  },
  days: [dayEntrySchema],
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

timesheetSchema.index({ storeId: 1, employeeId: 1, weekStart: 1 }, { unique: true })

timesheetSchema.methods.recalculateTotals = function(this: ITimesheet): ITimesheet {
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

export default mongoose.model<ITimesheet>('Timesheet', timesheetSchema)
