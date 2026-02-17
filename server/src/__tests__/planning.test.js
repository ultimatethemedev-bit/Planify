import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'

let app
let authToken

async function registerAndGetToken(appInstance) {
  const res = await request(appInstance)
    .post('/api/auth/register')
    .send({
      email: 'plan@example.com',
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Dupont',
      store1: 'Ma Boutique',
    })
  return res.body.token
}

beforeAll(async () => {
  const authRoutes = (await import('../routes/auth.js')).default
  const planningRoutes = (await import('../routes/planning.js')).default

  app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/planning', planningRoutes)
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
  authToken = await registerAndGetToken(app)
})

describe('GET /api/planning', () => {
  it('should return empty planning for a new week', async () => {
    const res = await request(app)
      .get('/api/planning?weekStart=2025-01-06')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.weekStart).toBe('2025-01-06')
    expect(res.body.shifts).toEqual([])
  })

  it('should reject missing weekStart', async () => {
    const res = await request(app)
      .get('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
  })

  it('should reject invalid date format', async () => {
    const res = await request(app)
      .get('/api/planning?weekStart=invalid')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
  })

  it('should require authentication', async () => {
    const res = await request(app).get('/api/planning?weekStart=2025-01-06')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/planning', () => {
  it('should create a new planning', async () => {
    const res = await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        weekStart: '2025-01-06',
        shifts: [
          {
            employeeId: '507f1f77bcf86cd799439011',
            date: '2025-01-06',
            startTime: '10:00',
            endTime: '18:00',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.weekStart).toBe('2025-01-06')
    expect(res.body.shifts).toHaveLength(1)
    expect(res.body.shifts[0].startTime).toBe('10:00')
  })

  it('should update existing planning', async () => {
    await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        weekStart: '2025-01-06',
        shifts: [
          { employeeId: '507f1f77bcf86cd799439011', date: '2025-01-06', startTime: '10:00', endTime: '18:00' },
        ],
      })

    const res = await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        weekStart: '2025-01-06',
        shifts: [
          { employeeId: '507f1f77bcf86cd799439011', date: '2025-01-06', startTime: '09:00', endTime: '17:00' },
          { employeeId: '507f1f77bcf86cd799439012', date: '2025-01-07', startTime: '10:00', endTime: '18:00' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.shifts).toHaveLength(2)
    expect(res.body.shifts[0].startTime).toBe('09:00')
  })

  it('should sanitize shift fields (no extra data)', async () => {
    const res = await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        weekStart: '2025-01-06',
        shifts: [
          {
            employeeId: '507f1f77bcf86cd799439011',
            date: '2025-01-06',
            startTime: '10:00',
            endTime: '18:00',
            maliciousField: 'hacked',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.shifts[0].maliciousField).toBeUndefined()
  })

  it('should reject invalid weekStart', async () => {
    const res = await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ weekStart: 'not-a-date', shifts: [] })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/planning/duplicate', () => {
  it('should duplicate planning to another week', async () => {
    await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        weekStart: '2025-01-06',
        shifts: [
          { employeeId: '507f1f77bcf86cd799439011', date: '2025-01-06', startTime: '10:00', endTime: '18:00' },
        ],
      })

    const res = await request(app)
      .post('/api/planning/duplicate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sourceWeekStart: '2025-01-06',
        targetWeekStart: '2025-01-13',
      })

    expect(res.status).toBe(200)
    expect(res.body.weekStart).toBe('2025-01-13')
    expect(res.body.shifts).toHaveLength(1)
    expect(res.body.shifts[0].date).toBe('2025-01-13')
  })
})

describe('DELETE /api/planning', () => {
  it('should delete a planning', async () => {
    await request(app)
      .post('/api/planning')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ weekStart: '2025-01-06', shifts: [] })

    const res = await request(app)
      .delete('/api/planning?weekStart=2025-01-06')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)

    const getRes = await request(app)
      .get('/api/planning?weekStart=2025-01-06')
      .set('Authorization', `Bearer ${authToken}`)

    expect(getRes.body.shifts).toEqual([])
  })
})
