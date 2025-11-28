import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
}, {
  timestamps: true,
})

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
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
  // Anciennes données (pour compatibilité)
  companyName: {
    type: String,
    trim: true,
  },
  // Nouvelles données multi-boutiques
  stores: [storeSchema],
  currentStoreId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
}, {
  timestamps: true,
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.password
  return user
}

export default mongoose.model('User', userSchema)