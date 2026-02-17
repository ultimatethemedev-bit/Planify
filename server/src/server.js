import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Validate required env vars
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// Import routes
import authRoutes from './routes/auth.js'
import employeesRoutes from './routes/employees.js'
import planningRoutes from './routes/planning.js'
import settingsRoutes from './routes/settings.js'
import timesheetsRoutes from './routes/timesheets.js'
import userRoutes from './routes/user.js'
import storesRoutes from './routes/stores.js'
import { runMigration } from './migration.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))

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
app.use('/api/stores', storesRoutes)

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
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB')
    await runMigration()
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  })