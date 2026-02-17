import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { beforeAll, afterAll } from 'vitest'

let mongoServer

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-vitest'
  process.env.JWT_EXPIRES_IN = '1d'
  process.env.NODE_ENV = 'test'

  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  if (mongoServer) await mongoServer.stop()
})
