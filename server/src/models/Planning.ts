import mongoose, { Document } from 'mongoose'

export interface IShift {
  _id?: mongoose.Types.ObjectId
  employeeId: mongoose.Types.ObjectId
  date: string
  startTime: string
  endTime: string
}

export interface IPlanning extends Document {
  userId?: mongoose.Types.ObjectId
  storeId: mongoose.Types.ObjectId
  weekStart: string
  weekEnd: string
  shifts: IShift[]
  isValidated: boolean
  validatedAt: Date | null
}

const shiftSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
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
    type: String,
    required: true,
  },
  weekEnd: {
    type: String,
    required: true,
  },
  shifts: [shiftSchema],
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

planningSchema.index({ storeId: 1, weekStart: 1 }, { unique: true })

export default mongoose.model<IPlanning>('Planning', planningSchema)
