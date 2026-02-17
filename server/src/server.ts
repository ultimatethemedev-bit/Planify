import express, { Request, Response, NextFunction } from 'express'
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
import { logger } from './utils/logger.js'
import { swaggerSpec } from './swagger.js'
import swaggerUi from 'swagger-ui-express'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10kb' }))

// API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  })
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
app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, method: req.method, url: req.url }, 'Unhandled error')
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  })
})

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' })
})

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI!)
  .then(async () => {
    logger.info('Connected to MongoDB')
    await runMigration()
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Server running')
    })
  })
  .catch((error: Error) => {
    logger.fatal({ err: error }, 'MongoDB connection failed')
    process.exit(1)
  })
