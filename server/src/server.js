import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Import routes
import authRoutes from './routes/auth.js'
import employeesRoutes from './routes/employees.js'
import planningRoutes from './routes/planning.js'
import settingsRoutes from './routes/settings.js'
import timesheetsRoutes from './routes/timesheet.js'
import userRoutes from './routes/user.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/employees', employeesRoutes)
app.use('/api/planning', planningRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/timesheets', timesheetsRoutes)
app.use('/api/user', userRoutes)

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// Connect to MongoDB and start server
let isConnected = false

async function connectDB() {
  if (isConnected) {
    return
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    isConnected = true
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

// For local development
if (process.env.NODE_ENV !== 'production') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  })
}

// Export for Vercel
export default async function handler(req, res) {
  await connectDB()
  return app(req, res)
}